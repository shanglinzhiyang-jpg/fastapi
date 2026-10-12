// スポーツニュース・今日のホームランの画面確認 (Playwright)
// 使い方: node tools/pw_news.js [URL] [スクリーンショットの保存先]
"use strict";
const assert = require("assert");
const { chromium, devices } = require("playwright");

const URL = process.argv[2] || "http://127.0.0.1:8765/index.html";
const OUT = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  const shot = async (n) => OUT && page.screenshot({ path: OUT + "/news_" + n + ".png" });
  await page.goto(URL);
  // 3D は重いので 2D 表示で確認する
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.Store && PB.UI && PB.UI.cur);
  await page.evaluate(() => {
    PB.Store.settings().gfx = "2d";
    PB.Store.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.UI && PB.UI.cur);
  await page.click("[data-act=pennant]");
  // 短期 (10 試合・毎日 12 球団が試合) で 1 週間ぶん進める
  await page.click('[data-act=len][data-arg="s10"]');
  await page.click('[data-act=inn][data-arg="3"]');
  await page.click("[data-act=go]");
  await page.waitForSelector('[data-act=simgo][data-arg="week"]');
  assert.strictEqual(await page.locator(".newsbox").count(), 0, "試合前にニュース枠");
  await page.click('[data-act=simgo][data-arg="week"]');
  await page.waitForFunction(() => PB.UI.cur && PB.UI.cur.isPenHub && !PB.Pennant.busy() && PB.Store.data.pennant.day >= 5 && document.querySelector(".nb-day"), null, { timeout: 120000 });
  await page.waitForSelector("[data-act=simgo]:not([disabled])");
  const lastLabel = await page.evaluate(() => PB.Pennant.dayLabel(PB.Store.data.pennant, PB.Store.data.pennant.day - 1));
  assert.strictEqual(await page.locator(".nb-day").textContent(), lastLabel, "ニュース枠の日付");
  await shot("hub");
  const pen = await page.evaluate(() => {
    const p = PB.Store.data.pennant;
    return { day: p.day, hr: PB.News.dayHRs(p, p.day - 1).length, my: p.my, lg: PB.Pennant.lgOf(p.my), results: p.results.filter((r) => r.day === p.day - 1).map((r) => ({ hr: r.hr.length, mine: r.home === p.my || r.away === p.my })) };
  });
  const strip = await page.locator(".nb-hr span").textContent();
  assert.strictEqual(strip, pen.hr ? pen.hr + "本" : "なし", "ハブの本数");
  // 今日のホームラン
  await page.click(".nb-hr");
  await page.waitForSelector(".nhr-head");
  const rows = page.locator(".nhr");
  assert.strictEqual(await rows.count(), pen.hr, "行数");
  const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  assert.ok(heights.every((h) => h >= 44), "行が低すぎる: " + heights.join(","));
  const sw = await page.evaluate(() => [document.querySelector(".screen").scrollWidth, document.querySelector(".screen").clientWidth]);
  assert.ok(sw[0] <= sw[1] + 1, "横スクロールが出る: " + sw);
  const lgOrder = await page.locator(".nhr-lg").allTextContents();
  if (lgOrder.length === 2) assert.ok(lgOrder[0].indexOf(pen.lg === "P" ? "パ" : "セ") === 0, "自リーグが先: " + lgOrder);
  if (pen.results.find((r) => r.mine && r.hr)) {
    const first = await page.locator(".nhr-lg").first().locator("xpath=following-sibling::div[contains(@class,'nhr-game')][1]/div[contains(@class,'nhr-gh')]").getAttribute("class");
    assert.ok(/mine/.test(first), "自チームの試合が先頭");
  }
  await shot("hrtab");
  await page.screenshot({ path: (OUT || "/tmp") + "/news_hrtab_full.png", fullPage: true }).catch(() => {});
  // 選手カード
  if (pen.hr) {
    await rows.first().click();
    await page.waitForSelector("#modal [data-act=close]", { timeout: 20000 }).catch(() => {});
    const opened = await page.evaluate(() => !!document.querySelector("#modal [data-act=close]"));
    assert.ok(opened, "選手カードが開かない");
    await page.waitForTimeout(400);
    await page.click("#modal [data-act=close]");
  }
  // 前日・翌日
  await page.click("[data-act=prev]");
  const d4 = await page.locator(".nday b").textContent();
  assert.strictEqual(d4, await page.evaluate(() => PB.Pennant.dayLabel(PB.Store.data.pennant, PB.Store.data.pennant.day - 2)), "前日の日付");
  const n4 = await page.evaluate(() => PB.News.dayHRs(PB.Store.data.pennant, PB.Store.data.pennant.day - 2).length);
  assert.strictEqual(await page.locator(".nhr").count(), n4, "前日の行数");
  await page.click("[data-act=next]");
  // 試合結果
  await page.click('[data-act=tab][data-arg="res"]');
  assert.strictEqual(await page.locator(".nr").count(), 6, "試合結果 6 試合");
  const perRow = await page.locator(".nr").evaluateAll((els) => els.map((e) => e.querySelectorAll(".nr-hr").length));
  const expect = await page.evaluate(() => {
    const p = PB.Store.data.pennant;
    const rs = PB.News.dayResults(p, p.day - 1);
    const lg = PB.Pennant.lgOf(p.my);
    return rs.filter((r) => PB.Pennant.lgOf(r.home) === lg).concat(rs.filter((r) => PB.Pennant.lgOf(r.home) !== lg)).map((r) => r.hr.length);
  });
  assert.deepStrictEqual(perRow, expect, "本塁打欄の数");
  await shot("results");
  await page.click('[data-act=tab][data-arg="news"]');
  assert.ok((await page.locator(".nitem").count()) >= 1, "ニュースがない");
  await shot("newslist");
  await page.click('[data-act=tab][data-arg="hr"]');
  // ダイジェスト
  if (pen.hr) {
    await page.addStyleTag({ content: ".hrdg *, .hrdg *::before { animation: none !important; transition: none !important; }" });
    await page.click("[data-act=digest]");
    await page.waitForSelector(".hrdg .hrdg-title");
    await shot("digest_title");
    await page.waitForSelector(".hrdg-idx", { timeout: 8000 });
    assert.ok(new RegExp("^\\d+ / " + pen.hr + "$").test(await page.locator(".hrdg-idx").textContent()), "番号の表示");
    await shot("digest_card");
    // タップで 1 本進む (自動送りと競合しないよう、ページ内で読んでからすぐタップする)
    const adv = await page.evaluate(() => {
      const idx = () => (document.querySelector(".hrdg-idx") || {}).textContent || "end";
      const a = idx();
      const root = document.querySelector(".hrdg");
      root.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 600 }));
      return [a, idx()];
    });
    // 自動送りで最後の画面まで進んでいたら確認しない (遅い環境ではスクリーンショット中に送られる)
    const k = parseInt(adv[0], 10);
    if (adv[0] !== "end") assert.ok(k >= pen.hr ? adv[1] === "end" : adv[1] === k + 1 + " / " + pen.hr, "タップで進まない: " + adv);
    const xb = await page.evaluate(() => {
      const r = document.querySelector(".hrdg-x").getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    assert.ok(xb.width >= 44 && xb.height >= 44, "閉じるボタンが小さい");
    // 最後まで送ってエンドカード
    for (let k = 0; k < pen.hr + 2; k++) {
      if (await page.locator(".hrdg-end").count()) break;
      await page.locator(".hrdg").click({ position: { x: 200, y: 600 } });
    }
    await page.waitForSelector(".hrdg-end");
    await shot("digest_end");
    await page.locator(".hrdg-end [data-x]").first().tap();
    await page.waitForTimeout(500);
    assert.strictEqual(await page.locator(".hrdg").count(), 0, "閉じない");
    // 閉じたタップが下の画面 (選手カード) に届かない
    assert.ok(await page.evaluate(() => document.getElementById("modal").hidden), "閉じたタップで選手カードが開いた");
    // 開いたまま戻ってもダイジェストが残らない
    await page.click("[data-act=digest]");
    await page.waitForSelector(".hrdg");
    await page.evaluate(() => PB.UI.go(PB.Pennant.hub()));
    assert.strictEqual(await page.locator(".hrdg").count(), 0, "画面を離れても残る");
  }
  // 古いセーブ: 1 日目の本塁打の記録を消すと「記録開始前」
  await page.evaluate(() => {
    const p = PB.Store.data.pennant;
    for (const r of p.results) if (r.day === 0) delete r.hr;
    PB.UI.go(PB.News.screen({ day: 0, tab: "hr" }));
  });
  assert.ok(/記録開始前/.test(await page.locator(".news-body").textContent()), "記録開始前の表示");
  assert.deepStrictEqual(errs, [], "エラー: " + errs.join("\n"));
  console.log("day=" + pen.day + " hr=" + pen.hr);
  console.log("OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
