// ペナント (日程・一括消化・順位表・日程画面・ポストシーズン・表彰式・シーズン総括・一軍/二軍・記録室) の画面確認 (Playwright・2D 表示・390px)
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

  // 旧セーブ (日付なし・版番号なし) を読み込んで続きを遊べる
  await page.evaluate(() => {
    const p = PB.Pennant.create("t", 2, "normal", 3);
    for (const k of ["v", "opts", "year", "seed", "regDays", "clinch", "begun", "regEnd", "dates"]) delete p[k];
    delete p.newsState.magic;
    PB.Store.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.UI && PB.UI.cur);
  assert.strictEqual(await page.evaluate(() => PB.Store.data.pennant.v), await page.evaluate(() => PB.Pennant.V), "旧セーブが移行されない");
  assert.ok(/続きから/.test(await page.locator("[data-act=pennant] small").textContent()), "続きから");
  await page.click("[data-act=pennant]");
  await waitHub();
  assert.ok(/第1日/.test(await page.locator(".pen-date b").textContent()), "旧セーブの見出し");
  await page.click("[data-act=sim]");
  await page.waitForFunction(() => PB.Store.data.pennant.day === 1, null, { timeout: 60000 });
  await waitHub();
  assert.strictEqual(await page.evaluate(() => PB.Store.data.pennant.results.length), 6, "旧セーブの続き");
  await shot("legacy");
  await page.evaluate(() => {
    PB.Store.data.pennant = null;
    PB.Store.save();
    PB.UI.go(PB.Screens.title());
  });

  /* ---------- L3: 選手の状態・一軍/二軍・故障者・選手モーダル・記録室 ---------- */
  // 球団の写しのない v3 のセーブを読み込むと移行される
  await page.evaluate(() => {
    const p = PB.Pennant.create("t", { len: "s20", fast: "quick", seed: 71 });
    for (const k of ["teams", "life", "fstats", "records"]) delete p[k];
    p.v = 3;
    PB.Store.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.UI && PB.UI.cur);
  const mig = await page.evaluate(() => {
    const p = PB.Store.data.pennant;
    return { v: p.v, teams: (p.teams || []).length, gen: p.teams ? p.teams[0].players.filter((x) => x.gen).length : 0 };
  });
  assert.ok(mig.v === 4 && mig.teams === 12 && mig.gen > 30, "v3 のセーブが移行されない: " + JSON.stringify(mig));
  const quick0 = await page.evaluate(() => JSON.stringify(PB.Store.team("t").lineup) + JSON.stringify(PB.Store.team("t").bench));
  await page.click("[data-act=pennant]");
  await waitHub();
  await page.click('[data-act=simgo][data-arg="week"]');
  await waitHub();
  assert.ok(await page.locator(".pl-hub").count(), "ハブに故障者・好不調の表示がない");
  await page.locator(".pl-hub").scrollIntoViewIfNeeded();
  await shot("l3_hub");
  await noHScroll("ハブ (L3)");
  // 一軍・二軍
  await page.click("button[data-act=roster]");
  await page.waitForSelector(".pl-sum");
  assert.strictEqual(await page.locator(".pl-row").count(), await page.evaluate(() => PB.PenLife.counts(PB.Pennant.team("t")).n), "一軍の行数");
  await shot("l3_act", true);
  await noHScroll("一軍");
  const toast = () => page.locator("#toast").textContent();
  // 控えの捕手は 2 人を切るので断られる
  const cid = await page.evaluate(() => {
    const T = PB.Pennant.team("t");
    const cs = [...PB.PenLife.actIds(T)].map((id) => PB.Pennant.findPlayer(id).p).filter((x) => x.pos === "C");
    return cs.length <= 2 ? cs.find((x) => T.bench.indexOf(x.id) >= 0).id : null;
  });
  if (cid) {
    await page.click('[data-act=down][data-arg="' + cid + '"]');
    await page.waitForTimeout(100);
    assert.ok(/捕手が2人より少なく/.test(await toast()), "捕手の抹消を断らない: " + (await toast()));
    await page.waitForTimeout(400);
  }
  // 控えの選手 (捕手以外) を抹消 (確認してから)
  const pid = await page.evaluate(() => PB.Pennant.team("t").bench.find((id) => PB.Pennant.findPlayer(id).p.pos !== "C"));
  await page.click('[data-act=down][data-arg="' + pid + '"]');
  await page.waitForSelector(".modal-box [data-act=yes]");
  await page.waitForTimeout(450);
  await page.click(".modal-box [data-act=yes]");
  await page.waitForTimeout(100);
  assert.ok(/登録抹消しました/.test(await toast()), "抹消のトースト: " + (await toast()));
  // 二軍のタブ: 10 日以内に登録しようとすると断られる
  await page.click('[data-act=tab][data-arg="farm"]');
  await page.waitForSelector('.pl-row [data-act=up][data-arg="' + pid + '"]');
  assert.ok(/再登録まで10日/.test(await page.locator('.pl-row:has([data-arg="' + pid + '"])').textContent()), "二軍の行に 10 日の残り");
  await page.click('.pl-row [data-act=up][data-arg="' + pid + '"]');
  await page.waitForTimeout(100);
  assert.ok(/10日間は再登録できません/.test(await toast()), "10 日以内の登録が断られない: " + (await toast()));
  assert.ok(await page.evaluate((id) => !PB.PenLife.actIds(PB.Pennant.team("t")).has(id), pid), "断られたのに一軍に入った");
  await shot("l3_farm_toast");
  await page.locator(".pl-rule").scrollIntoViewIfNeeded();
  await shot("l3_farm", true);
  await noHScroll("二軍");
  // 故障者 (いなければテスト用に 1 人ケガをさせる)
  await page.evaluate(() => {
    const pen = PB.Store.data.pennant;
    const T = PB.Pennant.team(pen.my);
    if (!T.players.some((x) => x.st && x.st.inj)) PB.PenLife.injure(pen, T, PB.Pennant.findPlayer(T.lineup.find((e) => e.pos !== "P" && e.pos !== "C").id).p, "足首のねんざ", 12, pen.day);
  });
  await page.click('[data-act=tab][data-arg="inj"]');
  assert.ok((await page.locator(".pl-row.inj").count()) >= 1, "故障者のタブ");
  await shot("l3_inj");
  await noHScroll("故障者");
  // 選手モーダル (状態・二軍成績・記録)
  await page.click(".pl-row.inj .pl-nm");
  await page.waitForSelector(".modal-box .plm");
  await page.waitForTimeout(700);
  assert.ok(/ケガ/.test(await page.locator(".modal-box .plm").first().textContent()), "モーダルにケガの表示");
  await shot("l3_modal");
  await page.waitForTimeout(100);
  await page.click(".modal-box [data-act=close]");
  // 自動入れ替えのオン・オフ
  await page.click('[data-act=tab][data-arg="act"]');
  await page.click("[data-act=auto]");
  assert.strictEqual(await page.evaluate(() => PB.Store.data.pennant.life.auto), false, "自動入れ替えをオフにできない");
  await page.click("[data-act=auto]");
  await page.click("[data-act=back]");
  await waitHub();
  // オーダー: ペナントの一軍だけ。変えてもクイック対戦の球団は変わらない
  await page.click("[data-act=order]");
  await page.waitForSelector(".orow");
  const benchN = await page.locator(".orow.bench").count();
  assert.strictEqual(benchN, await page.evaluate(() => PB.Pennant.team("t").bench.length), "オーダーの控えがペナントの一軍と違う");
  await page.click("[data-act=auto]");
  await page.click("[data-act=done]");
  await waitHub();
  assert.strictEqual(await page.evaluate(() => JSON.stringify(PB.Store.team("t").lineup) + JSON.stringify(PB.Store.team("t").bench)), quick0, "ペナントのオーダーがクイック対戦の球団に漏れた");
  // 記録室
  await page.click("[data-act=records]");
  await page.waitForSelector(".rc-body");
  for (const tab of ["feat", "streak", "ms"]) {
    await page.click('[data-act=tab][data-arg="' + tab + '"]');
    await shot("l3_rec_" + tab, true);
    await noHScroll("記録室 " + tab);
  }
  await page.click("[data-act=back]");
  await waitHub();
  // 個人成績から選手モーダル
  await page.click("[data-act=leaders]");
  await page.click(".ltbl tr[data-act=player]");
  await page.waitForSelector(".modal-box .plm");
  await page.waitForTimeout(450);
  await page.click(".modal-box [data-act=close]");
  await page.click("[data-act=back]");
  await waitHub();
  // ニュース: ケガ・登録の記事
  const lifeNews = await page.evaluate(() => PB.Store.data.pennant.news.filter((n) => /^(inj|move)$/.test(n.kind)).length);
  console.log("L3: 移行 v3→v4・一軍/二軍/故障者・抹消→10日以内の登録を断る・モーダル・オーダー・記録室  (ケガ・登録の記事 " + lifeNews + ")");
  await page.evaluate(() => {
    PB.Store.data.pennant = null;
    PB.Store.save();
    PB.UI.go(PB.Screens.title());
  });

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

  // 次の日へ (休みの日を 1 日進める)
  await page.click("[data-act=nextday]");
  await page.waitForFunction(() => PB.Store.data.pennant.day === 1, null, { timeout: 30000 });
  await waitHub();
  assert.ok(/3月28日\(日\)/.test(await page.locator(".pen-date b").textContent()), "次の日へ");
  // 次の試合まで → セの開幕日
  await page.click('[data-act=simgo][data-arg="next"]');
  await waitHub();
  let p = await pen();
  assert.ok(await page.locator(".matchcard").count(), "次の試合までで試合の日に止まらない");
  assert.ok(/4月2日\(金\)/.test(await page.locator(".pen-date b").textContent()), "セの開幕日: " + (await page.locator(".pen-date b").textContent()));
  assert.ok(/第1戦/.test(await page.locator(".pen-date span").textContent()), "第1戦");
  await shot("hub_game");
  // この試合をおまかせ (自分の試合は物理版)
  const dg = p.day;
  await page.click("[data-act=sim]");
  await page.waitForFunction((d) => PB.Store.data.pennant.day === d + 1, dg, { timeout: 60000 });
  await waitHub();
  assert.ok(
    await page.evaluate((d) => PB.Store.data.pennant.results.some((r) => r.day === d && (r.home === PB.Store.data.pennant.my || r.away === PB.Store.data.pennant.my)), dg),
    "おまかせの試合が記録されていない"
  );
  assert.ok(/第2戦/.test(await page.locator(".pen-date span").textContent()), "第2戦");
  p = await pen();

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

  // シーズン終了まで (最後まで) → レギュラーシーズンの後はポストシーズン (第1ステージの開幕画面)
  await page.click('[data-act=simgo][data-arg="season"]');
  await page.waitForFunction(() => PB.Store.data.pennant.day >= PB.Store.data.pennant.regDays && PB.UI.cur && !PB.UI.cur.isPenSim, null, { timeout: 180000 });
  p = await pen();
  assert.strictEqual(p.day, p.regDays, "シーズン終了まで");
  assert.ok(!p.finished, "ポストシーズンの前に終わった");
  assert.ok(/第1ステージ/.test(await page.locator(".res-head h2").textContent()), "第1ステージの開幕画面");
  await shot("post_full_intro", true);
  await noHScroll("開幕画面 (フル)");
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
  console.log("clinch: " + clinch.join(" / ") + "  save=" + kb + "KB");

  /* ---------- L2: 短期シーズン → ポストシーズン → 表彰式 → シーズン総括 ---------- */
  await page.evaluate(() => {
    PB.Store.data.pennant = null;
    PB.Store.save();
    PB.UI.go(PB.Screens.title());
  });
  await page.click("[data-act=pennant]");
  await page.waitForSelector("[data-act=len]");
  assert.ok(await page.locator('[data-act=post][data-arg="2004"].on').count(), "ポストシーズンの既定は 2004 年方式");
  assert.ok(/2004年と同じ/.test(await page.locator(".pen-postnote").textContent()), "2004 年方式の説明");
  await page.click('[data-act=post][data-arg="cs"]');
  assert.ok(/後年ルール/.test(await page.locator(".pen-postnote").textContent()), "CS は後年ルールと表示");
  await page.click('[data-act=post][data-arg="2004"]');
  await page.click('[data-act=len][data-arg="s10"]');
  await page.click('[data-act=fast][data-arg="quick"]');
  await shot("post_setup", true);
  await page.click("[data-act=go]");
  await waitHub();
  await page.click('[data-act=simgo][data-arg="season"]');
  await page.waitForFunction(() => PB.Store.data.pennant.day >= PB.Store.data.pennant.regDays && PB.UI.cur && !PB.UI.cur.isPenSim, null, { timeout: 120000 });
  // 開幕画面 → ハブ (トーナメント表)
  assert.ok(await page.locator(".pp-vs").count(), "開幕画面のマーク対決");
  await shot("post_intro", true);
  await noHScroll("開幕画面");
  await page.click("[data-act=go]");
  await page.waitForFunction(() => PB.UI.cur && PB.UI.cur.isPostHub && !PB.Pennant.busy());
  assert.ok(await page.locator(".pp-bracket .pp-card").first().isVisible(), "トーナメント表が見えない");
  assert.ok((await page.locator(".pp-card").count()) >= 3, "トーナメント表のカード");
  await shot("post_hub", true);
  await noHScroll("ポストシーズンのハブ");
  // 観戦: 自分の出ない試合を画面で見る (ここでは最後まで早送りして記録されることを確かめる)
  const mineToday = await page.evaluate(() => !!PB.Pennant.myMatch(PB.Store.data.pennant));
  if (!mineToday) {
    const d0 = (await pen()).day;
    await page.click("[data-act=watch]");
    await page.waitForFunction(() => PB.main.match && PB.main.match.g && PB.main.match.g.user === null, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const m = PB.main.match;
      m.g.simToEnd();
      m.finish();
    });
    await page.waitForSelector(".res-extra", { timeout: 60000 });
    assert.ok(/第1ステージ/.test(await page.locator(".res-extra").textContent()), "結果画面にシリーズの状況: " + (await page.locator(".res-extra").textContent()));
    await shot("post_watch_result");
    assert.ok(
      await page.evaluate((d) => PB.Store.data.pennant.results.some((r) => r.day === d && r.ps === "P1") && PB.PenPost.series(PB.Store.data.pennant, "P1").games.length === 1, d0),
      "観戦した試合が記録されていない"
    );
    await page.click("[data-act=done]");
  }
  // 自分の試合はおまかせ、それ以外は「シリーズを最後までおまかせ」で日本シリーズの決着まで
  let cel = 0;
  for (let guard = 0; guard < 80; guard++) {
    await page.waitForFunction(() => PB.UI.cur && !PB.UI.cur.isPenSim && !PB.Pennant.busy(), null, { timeout: 120000 });
    await page.waitForTimeout(150);
    const acts = await page.evaluate(() => [...document.querySelectorAll("[data-act]")].map((e) => e.getAttribute("data-act")));
    if (acts.includes("awards")) break;
    if (acts.includes("go")) {
      await page.click("[data-act=go]");
      continue;
    }
    if (acts.includes("next")) {
      // 決着の画面 (紙吹雪・シリーズ MVP の選手カード)
      await page.waitForTimeout(700);
      assert.ok(await page.locator(".pp-confetti").count(), "紙吹雪");
      assert.ok(await page.locator(".mvp-pc canvas").count(), "シリーズ MVP の選手カード");
      await shot("post_celebrate_" + cel++);
      await noHScroll("決着の画面");
      await page.click("[data-act=next]");
      continue;
    }
    if (acts.includes("play")) await page.click("[data-act=sim]");
    else if (acts.includes("simser")) {
      await page.click("[data-act=simser]");
      await page.waitForTimeout(200);
      if (await page.locator(".modal-box [data-act=yes]").count()) await page.click(".modal-box [data-act=yes]");
    } else throw new Error("ポストシーズンで進めない: " + acts.join(","));
  }
  assert.ok(cel >= 2, "決着の画面 (パ・リーグ優勝・日本一) が出ない: " + cel);
  await shot("post_awards_day", true);
  await noHScroll("表彰式の日");
  // 表彰式
  await page.click("[data-act=awards]");
  await page.waitForSelector(".aw-banner");
  assert.ok(await page.evaluate(() => PB.Store.data.pennant.finished), "表彰式の後にシーズンが終わらない");
  await page.waitForTimeout(800);
  await shot("post_ceremony", true);
  await noHScroll("表彰式");
  for (const [lg, tab] of [
    ["C", "title"],
    ["C", "b9"],
    ["P", "b9"],
    ["P", "gg"],
    ["C", "mon"],
  ]) {
    await page.click('[data-act=lg][data-arg="' + lg + '"]');
    await page.click('[data-act=tab][data-arg="' + tab + '"]');
    if (tab === "b9") assert.strictEqual(await page.locator(".aw-p").count(), lg === "P" ? 10 : 9, "ベストナインの人数 " + lg);
    await shot("post_aw_" + tab + lg, true);
    await noHScroll("表彰 " + tab + lg);
  }
  // シーズン総括
  await page.click("[data-act=back]");
  await page.waitForSelector(".pen-champs");
  assert.ok(/日本一/.test(await page.locator(".res-head h2").textContent()), "総括の見出し");
  await shot("post_summary", true);
  await noHScroll("シーズン総括");
  await page.click("[data-act=post]");
  await page.waitForSelector(".pp-card");
  await noHScroll("トーナメント表 (総括から)");
  await page.click("[data-act=back]");
  await page.click("[data-act=leaders]");
  await page.click('[data-act=tab][data-arg="title"]');
  assert.ok(await page.locator(".tr-row").count(), "タイトル争い");
  await shot("post_race", true);
  await noHScroll("タイトル争い");
  await page.click("[data-act=back]");
  await page.click("[data-act=news]");
  await page.waitForSelector(".nday");
  assert.ok(/表彰式/.test(await page.locator(".nday b").textContent()), "ニュースの日送りに表彰式の日");
  await shot("post_news_awards", true);
  await page.click("[data-act=prev]");
  assert.ok(/日本シリーズ/.test(await page.locator(".nday b").textContent()), "日本シリーズの日の見出し");
  await noHScroll("ニュース (日本シリーズ)");
  // タイトル画面: ペナントは「新しいシーズン」から
  assert.ok(/12球団/.test(await page.evaluate(() => (PB.UI.go(PB.Screens.title()), document.querySelector("[data-act=pennant] small").textContent))), "終わったシーズンのタイトル画面");
  const post = await page.evaluate(() => {
    const p = PB.Store.data.pennant;
    return { js: PB.Pennant.team(p.post.champs.JS).short, n: p.results.filter((r) => r.ps).length, kb: Math.round(localStorage.getItem(PB.Store.KEY).length / 1024) };
  });
  console.log("postseason: 日本一 " + post.js + " (" + post.n + "試合) save=" + post.kb + "KB");
  assert.deepStrictEqual(errs, [], "エラー: " + errs.join("\n"));
  console.log("OK");
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
