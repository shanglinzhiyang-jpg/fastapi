// ペナント (日程・一括消化・順位表・日程画面) の画面確認 (Playwright・2D 表示・390px)
// 使い方: node tools/pw_pennant.js [URL] [スクリーンショットの保存先]
"use strict";
const assert = require("assert");
const { chromium, devices } = require("playwright");

const URL = process.argv[2] || "http://127.0.0.1:8765/index.html";
const OUT = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  const shot = async (n, full) => OUT && page.screenshot({ path: OUT + "/pen_" + n + ".png", fullPage: !!full });
  // 横スクロールが出ない (画面と表の両方)
  const noHScroll = async (what) => {
    const r = await page.evaluate(() => {
      const s = document.querySelector(".screen");
      const wraps = [...document.querySelectorAll(".tbl-wrap")].map((w) => [w.scrollWidth, w.clientWidth]);
      return { s: [s.scrollWidth, s.clientWidth], wraps };
    });
    assert.ok(r.s[0] <= r.s[1] + 1, what + ": 横スクロールが出る " + r.s);
    for (const w of r.wraps) assert.ok(w[0] <= w[1] + 1, what + ": 表がはみ出る " + w);
  };
  const pen = () => page.evaluate(() => ({ day: PB.Store.data.pennant.day, date: PB.Pennant.dateOf(PB.Store.data.pennant, PB.Store.data.pennant.day), regDays: PB.Store.data.pennant.regDays, finished: PB.Store.data.pennant.finished }));
  const waitHub = (ms) => page.waitForFunction(() => PB.UI.cur && PB.UI.cur.isPenHub && !PB.Pennant.busy(), null, { timeout: ms || 120000 });

  await page.goto(URL);
  // 3D は重いので 2D 表示で確認する
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.Store && PB.UI && PB.UI.cur);
  await page.evaluate(() => {
    PB.Store.settings().gfx = "2d";
    PB.Store.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.UI && PB.UI.cur);
  assert.ok(/12球団/.test(await page.locator("[data-act=pennant] small").textContent()), "タイトルの文言");

  // 新規作成: フル (2004 年)・他球場は高速
  await page.click("[data-act=pennant]");
  await page.waitForSelector("[data-act=len]");
  assert.ok(await page.locator('[data-act=len][data-arg="full"].on').count(), "既定はフル");
  assert.ok(/138/.test(await page.locator(".pen-lennote").textContent()), "セ138・パ133 の説明");
  assert.ok(await page.locator("[data-act=strike].on").count(), "ストライキの中止が既定で ON");
  await page.click('[data-act=fast][data-arg="quick"]');
  await shot("setup", true);
  await noHScroll("新規作成");
  await page.click("[data-act=go]");
  await waitHub();
  // 3/27 はパだけの開幕日 (阪神は休み)
  assert.ok(/3月27日\(土\)/.test(await page.locator(".pen-date b").textContent()), "見出しに日付");
  assert.ok(/全138戦/.test(await page.locator(".pen-date span").textContent()), "全138戦");
  assert.ok(await page.locator(".pen-off").count(), "休みの日の表示");
  await shot("hub_off");
  await noHScroll("ハブ (休み)");

  // 次の試合まで → セの開幕日
  await page.click('[data-act=simgo][data-arg="next"]');
  await waitHub();
  let p = await pen();
  assert.ok(await page.locator(".matchcard").count(), "次の試合までで試合の日に止まらない");
  assert.ok(/4月2日\(金\)/.test(await page.locator(".pen-date b").textContent()), "セの開幕日: " + (await page.locator(".pen-date b").textContent()));
  assert.ok(/第1戦/.test(await page.locator(".pen-date span").textContent()), "第1戦");
  await shot("hub_game");

  // 1 週間
  const d0 = p.date;
  await page.click('[data-act=simgo][data-arg="week"]');
  await page.waitForSelector(".pen-simv", { timeout: 10000 }).catch(() => {});
  await waitHub();
  p = await pen();
  assert.ok(p.date - d0 >= 7, "1週間で日付が進まない: " + d0 + " → " + p.date);
  // 順位表: 差・残
  const heads = await page.locator(".stand.pen-st tr").first().locator("th").allTextContents();
  assert.ok(heads.indexOf("差") >= 0 && heads.indexOf("残") >= 0, "順位表の列: " + heads.join(","));
  assert.ok(await page.locator(".stand.pen-st th:has-text('残')").isVisible(), "残の列が見えない");
  await shot("hub_week", true);
  await noHScroll("ハブ (順位表)");
  // 詳細・対戦成績・パ・リーグ
  await page.click('[data-act=sttab][data-arg="detail"]');
  assert.ok(await page.locator(".pen-l10").count(), "直近10試合");
  await noHScroll("直近・連勝");
  await page.locator(".pen-dt").scrollIntoViewIfNeeded();
  await shot("hub_detail");
  await page.click('[data-act=sttab][data-arg="vs"]');
  await noHScroll("対戦成績");
  await page.locator(".pen-vs").scrollIntoViewIfNeeded();
  await shot("hub_vs");
  await page.click('[data-act=stlg][data-arg="P"]');
  await noHScroll("対戦成績 (パ)");
  await page.click('[data-act=sttab][data-arg="st"]');

  // 日程画面
  await page.click("[data-act=sched]");
  await page.waitForSelector(".ps-row");
  assert.ok((await page.locator(".ps-row.done").count()) >= 3, "済みの試合");
  assert.ok((await page.locator(".ps-row:not(.done)").count()) >= 3, "これからの試合");
  assert.ok(/架空の日程/.test(await page.locator(".scr-body .note").first().textContent()), "架空の日程の注記");
  await shot("schedule");
  await noHScroll("日程");
  await page.click('[data-act=mo][data-arg="9"]');
  assert.ok(/9月/.test(await page.locator(".ps-sum").textContent()));
  await shot("schedule_sep");
  await page.click("[data-act=back]");
  await waitHub();

  // 月末まで
  const m0 = await page.evaluate(() => PB.PenSched.month(PB.Pennant.dateOf(PB.Store.data.pennant, PB.Store.data.pennant.day)));
  await page.click('[data-act=simgo][data-arg="month"]');
  await waitHub();
  const m1 = await page.evaluate(() => PB.PenSched.month(PB.Pennant.dateOf(PB.Store.data.pennant, PB.Store.data.pennant.day)));
  assert.ok(m1 !== m0, "月末まで");

  // シーズン終了まで → 進行表示 → 中断 (その日を終えて止まる)
  p = await pen();
  await page.click('[data-act=simgo][data-arg="season"]');
  await page.waitForSelector(".pen-simv");
  await page.waitForFunction((d) => PB.Store.data.pennant.day >= d + 3, p.day, { timeout: 30000 });
  await shot("simview");
  await noHScroll("進行表示");
  await page.click("[data-act=cancel]");
  await waitHub();
  const pc = await pen();
  assert.ok(pc.day < pc.regDays, "中断できない");
  assert.ok(await page.evaluate(() => !PB.Pennant.partialDay(PB.Store.data.pennant)), "中断で途中の日が残った");

  // シーズン終了まで (最後まで)
  await page.click('[data-act=simgo][data-arg="season"]');
  await page.waitForFunction(() => PB.Store.data.pennant.finished && PB.UI.cur && !PB.UI.cur.isPenSim, null, { timeout: 180000 });
  p = await pen();
  assert.strictEqual(p.day, p.regDays, "シーズン終了まで");
  await shot("final", true);
  await noHScroll("最終画面");
  const counts = await page.evaluate(() => ["C", "P"].map((lg) => PB.Pennant.standings(PB.Store.data.pennant, lg).map((x) => x.g)));
  assert.ok(
    counts[0].every((g) => g === 138) && counts[1].every((g) => g === 133),
    "試合数: " + JSON.stringify(counts)
  );
  // ニュースに優勝の記事
  const clinch = await page.evaluate(() => PB.Store.data.pennant.news.filter((n) => n.kind === "clinch").map((n) => n.title));
  assert.strictEqual(clinch.length, 2, "優勝・1位通過の記事: " + clinch.join(" / "));
  // 保存の大きさ
  const kb = await page.evaluate(() => Math.round(localStorage.getItem(PB.Store.KEY).length / 1024));
  assert.ok(kb < 1600, "セーブが大きい: " + kb + "KB");
  assert.deepStrictEqual(errs, [], "エラー: " + errs.join("\n"));
  console.log("clinch: " + clinch.join(" / ") + "  save=" + kb + "KB");
  console.log("OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
