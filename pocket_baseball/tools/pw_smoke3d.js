// 3D 表示の動作確認 (Playwright): タイトル → クイック対戦 → 打者視点 → 打球 (守備視点) を撮り、エラーが無いかを見る
// 使い方: node tools/pw_smoke3d.js [保存先] [opp=g] [my=t] [side=watch] [night=1] [gfx=mid] [wait=40] [ff=1] [url=http://127.0.0.1:8765/index.html]
// 保存先に smoke_title.png / smoke_bat.png / smoke_field.png を書く。エラーがあれば終了コード 1
"use strict";
const fs = require("fs");
const { chromium, devices } = require("playwright");

const args = process.argv.slice(2);
const OUT = args[0] && !args[0].includes("=") ? args.shift() : null;
const O = { my: "t", opp: "g", side: "watch", night: "1", gfx: "mid", wait: "40", ff: "1", url: "http://127.0.0.1:8765/index.html" };
for (const a of args) {
  const i = a.indexOf("=");
  if (i > 0) O[a.slice(0, i)] = a.slice(i + 1);
}
if (OUT) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => {
    // 書体 (Google Fonts) はオフラインでは読めないので除く
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  // 守備視点はソフトウェア描画だと 1 フレームに数秒かかるので待ち時間を長く
  const shot = async (n) => OUT && page.screenshot({ path: OUT + "/smoke_" + n + ".png", timeout: 180000 });
  // 3D の集計と、2 秒間に描けたフレーム数 (fps)
  const info = () =>
    page.evaluate(
      () =>
        new Promise((res) => {
          let n = 0;
          const t0 = performance.now();
          const f = () => {
            n++;
            if (performance.now() - t0 < 2000) requestAnimationFrame(f);
            else res(Object.assign({ fps: Math.round((n / (performance.now() - t0)) * 10000) / 10 }, PB.View3D && PB.View3D.info ? PB.View3D.info() : {}));
          };
          requestAnimationFrame(f);
        })
    );
  const matchState = () =>
    page.evaluate(() => {
      const m = PB.main.match;
      return m ? { state: m.state, t: Math.round(m.t * 100) / 100, inn: m.g.inning, top: m.g.top, outs: m.g.outs } : null;
    });
  // 試合が cond ("ready": 投球待ち / "field": 打球が飛んで守備視点) になるまで待つ (最大 sec 秒)。
  // ソフトウェア描画は 1 フレームが遅く実時間では何分もかかるので、試合の時間だけ先に進める (ff=0 で実時間のまま)
  const until = async (cond, sec) => {
    const t0 = Date.now();
    while (Date.now() - t0 < sec * 1000) {
      const ok = await page.evaluate(
        ([cond, ff]) => {
          const m = PB.main && PB.main.match;
          const hit = () => (cond === "ready" ? m.state === "ready" : m.state === "inplay" && m.camBlend > 0.9);
          if (!m) return false;
          if (ff) for (let i = 0; i < 60 && !hit(); i++) m.update(1 / 30);
          return hit();
        },
        [cond, O.ff !== "0"]
      );
      if (ok) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  await page.goto(O.url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.Store && PB.UI && PB.UI.cur, null, { timeout: 90000 });
  await page.evaluate((g) => {
    PB.Store.settings().gfx = g;
    PB.Store.save();
  }, O.gfx);
  await page.reload();
  await page.waitForFunction(() => window.PB && PB.UI && PB.UI.cur, null, { timeout: 90000 });
  // タイトル: 選手モデルを読み込んで 3D の背景に人が出るまで
  await page.waitForFunction(() => PB.Human && (PB.Human.ready || PB.Human.failed), null, { timeout: 120000 }).catch(() => {});
  await page.waitForFunction(() => PB.View3D && PB.View3D.active && PB.View3D.info().actors > 0, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const t = await page.evaluate(() => ({ v3: !!(PB.View3D && PB.View3D.active), human: !!(PB.Human && PB.Human.ready), failed: !!(PB.Human && PB.Human.failed) }));
  console.log("title " + JSON.stringify(Object.assign(t, await info())));
  if (O.gfx !== "2d" && !t.v3) errs.push("3D になっていない");
  if (t.failed) errs.push("選手モデルを読み込めない");
  await shot("title");
  // クイック対戦 (チーム・先攻後攻・時間帯は引数で)
  await page.click("[data-act=exhibition]");
  await page.waitForSelector("[data-act=play]");
  await page.evaluate((o) => {
    const st = PB.Screens._exh;
    st.my = o.my;
    st.opp = o.opp;
    st.side = o.side;
    st.night = o.night === "1";
  }, O);
  await page.click("[data-act=play]");
  // 打者視点 (投球を待つところ)。数フレーム描いてから撮る
  const ready = await until("ready", 180);
  if (!ready) errs.push("打席が始まらない " + JSON.stringify(await matchState()));
  await page.waitForTimeout(1000);
  console.log("bat " + JSON.stringify(Object.assign({ ready }, await matchState(), await info())));
  await shot("bat");
  // CPU に投げさせて、打球が飛ぶ (守備視点になる) まで。最大 wait 秒
  const inplay = await until("field", Number(O.wait));
  if (inplay) await page.waitForTimeout(600);
  console.log("field " + JSON.stringify(Object.assign({ inplay }, await matchState(), await info())));
  await shot("field");
  console.log("errors " + JSON.stringify(errs.slice(0, 10)));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
