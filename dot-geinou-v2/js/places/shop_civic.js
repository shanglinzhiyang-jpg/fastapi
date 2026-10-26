// 暮らしの窓口 [R12-S2]: ドット銀行 (shop_ginko), ドット郵便局 (shop_yubin), 駅前交番 (shop_koban) in ドット商店街の駅前.
//
//   shop_ginko   窓口 (平日 9:00〜15:00) and the ATM corner (the hours of the era): 預け入れ・引き出し・定期預金・明細・金利の相談,
//                ローンの相談 (crime.js g.loanCounter('bank')). It works on the same account as the phone's 銀行 app
//                (phone_apps.js appState(g).bank): no ATM fee at the window; after hours 令和 / 平成 the ATM takes a 時間外手数料.
//   shop_yubin   郵便局 (平日 9:00〜17:00): stamps (the real postage of the game year), 手紙・はがき to a friend or the family (♥),
//                年賀状 in December, 現金書留 for 仕送り (family.js sendMoney), 貯金 (the same account; 郵便貯金 until 2007-09, ゆうちょ銀行 after).
//   shop_koban   交番: 道を聞く (the way to any place, from the real door positions), 落とし物 (hand in a found wallet), 相談
//                (闇金 → g.policeConsult, ストーカー, 借金), 自首したい (g.arrest), and the 手配度: at ★2+ the officer may stop you (g.shokushitsu).
// Everything is fictional. Facts: postage (封書 定形25g / はがき): 1981-01 ¥60/¥40, 1989-04 ¥62/¥41, 1994-01 ¥80/¥50, 2014-04 ¥82/¥52,
// 2017-06 はがき ¥62, 2019-10 ¥84/¥63, 2024-10 ¥110/¥85. 郵政民営化: ゆうちょ銀行・日本郵便 from 2007-10-01.

import {
  registerShop, room, npc, sign, who, SS, dayN, bumpN, firstVisit, byEra, eraId, yearNow, monthNow, has, passTime, T, nowTotal, openState, hoursOf,
  fmtMoney, YEN_MARK, adult, ageNow, LOOKS, PLACES, ITEMS, registerItem, weekdayOf, clamp, MODS,
} from '../world/shopkit.js';
import { display } from '../engine/util.js';
import { GUIDE, GUIDE_ORDER } from '../world/guide.js';
import { doorIndexFor } from '../engine/map.js';

const toInternal = (shown) => Math.max(1, Math.round(shown / (display.priceRate || 1)));
const real = (yen) => `${YEN_MARK}${yen}円`; // a fixed real-world price (not scaled by the era)
const POLICE = { hair: 'cap', hat: '#1e2a50', hairColor: 'black', skin: 'fair', top: '#2a3a6a', bottom: '#1e2a50', tie: '#14182a' };
const pa = async () => MODS.phone || null;

// ====================================================================== the bank account (the 銀行 app's, at a window)
const TERM = 120, TEIKI_MIN = 10000, LOG_MAX = 40, CREDIT_EVERY = 60;
const pct = (v) => `${v >= 1 ? v.toFixed(2) : String(+v.toFixed(3))}%`;
function tally(B, day) { if (day > B.lastDay) B.sekisu += B.bal * (day - B.lastDay); B.lastDay = day; }
function blog(B, day, what, amount) { B.log.unshift({ day, what, amount: Math.round(amount), bal: B.bal }); if (B.log.length > LOG_MAX) B.log.length = LOG_MAX; }
const AMOUNTS = [1000, 5000, 10000, 30000, 50000, 100000, 300000, 500000, 1000000];
async function pickAmount(g, title, max, min = 1, sub = '') {
  const list = AMOUNTS.map(toInternal).filter((n) => n >= min && n <= max);
  const items = list.map((n) => ({ label: fmtMoney(n), right: sub }));
  if (max >= min && !list.includes(max)) items.push({ label: `全額（${fmtMoney(max)}）`, right: sub });
  const all = [...list, max];
  if (!items.length) return 0;
  const k = await g.list({ title, items, x: 12, y: 44, w: 380, px: true });
  return k < 0 ? 0 : all[k];
}
// ATM hours by era (a rough guide: 平日 / 土 / 日). 令和 is open all day (a fee after the bank's hours).
const ATM = {
  showa: { byDay: { 0: [[T(9), T(19)]], 1: [[T(9), T(19)]], 2: [[T(9), T(19)]], 3: [[T(9), T(19)]], 4: [[T(9), T(19)]], 5: [[T(9), T(14)]], 6: [] }, spans: [[T(9), T(19)]], note: '（CD・ATM 平日19時まで／土曜14時まで／日曜休み）' },
  heisei_early: { spans: [[T(8), T(21)]], byDay: { 5: [[T(9), T(19)]], 6: [[T(9), T(17)]] }, note: '（ATM 平日21時まで／土曜19時／日曜17時まで）' },
  heisei: { spans: [[T(7), T(23)]], note: '（ATM 7時〜23時）' },
  reiwa: { spans: [[0, T(30)]], note: '（ATM 24時間）' },
};
const atmHours = (g) => ATM[eraId(g)] || ATM.reiwa;
const WINDOW = { spans: [[T(9), T(15)]], closed: [5, 6], note: '窓口 土日休み' };
const afterHoursFee = (g) => byEra(g, { showa: 0, heisei_early: 0, heisei: 105, reiwa: 110 });
const clerkOpen = (g) => openState(g, WINDOW).open;
const bankName = (g) => 'ドット銀行';

async function bankService(g, { kind, where }) {
  const M = await pa();
  if (!M || !M.appState) { await g.say('（機械の調子が悪いようだ…）'); return; }
  const lb = typeof M.lifeBlock === 'function' ? M.lifeBlock(g) : null;
  if (lb) { await g.say(lb); return; }
  const day = g.state.day;
  const atm = kind === 'atm';
  const fee = atm && !clerkOpen(g) ? afterHoursFee(g) : 0;
  for (let guard = 0; guard < 30; guard++) {
    const B = M.appState(g).bank;
    const rows = [
      { id: 'in', label: '預け入れる' }, { id: 'out', label: '引き出す' },
      { id: 'bal', label: '残高をみる', right: fmtMoney(M.bankBalance(g)) },
      ...(atm ? [] : [{ id: 'teiki', label: '定期預金をつくる', right: `年${pct(M.teikiRate(g))}`, disabled: !B.opened || B.bal < TEIKI_MIN }, { id: 'list', label: '定期預金の一覧・解約', disabled: !B.time.length }]),
      { id: 'log', label: byEra(g, { showa: '通帳に記入する', heisei_early: '通帳に記入する', heisei: '通帳記入・明細', reiwa: '明細をみる' }), disabled: !B.log.length },
      ...(atm ? [] : [{ id: 'help', label: '金利のこと' }, ...(has(g, 'loanCounter') ? [{ id: 'loan', label: 'ローンのご相談' }] : [])]),
      { id: 'end', label: 'おわる' },
    ];
    const k = await g.list({
      title: `${bankName(g)} ${atm ? 'ATM' : '窓口'}${fee ? `（時間外手数料 ${fmtMoney(fee)}）` : ''}　預金 ${fmtMoney(B.bal)}`,
      items: rows.map((r) => ({ label: r.label, right: r.right || '', disabled: !!r.disabled })), cancel: rows.length - 1, x: 12, y: 44, w: 420, px: true,
    });
    if (k < 0 || rows[k].id === 'end') return;
    const id = rows[k].id;
    if (rows[k].disabled) { await g.say(id === 'teiki' ? '定期預金にするには、普通預金に\n' + fmtMoney(TEIKI_MIN) + '以上が必要です。' : 'いまは、ご利用いただけないようです。', atm ? {} : who(CLERK)); continue; }
    if (id === 'bal') { await g.say([`普通預金 ${fmtMoney(B.bal)}\n定期預金 ${fmtMoney(B.time.reduce((s, t) => s + t.amount, 0))}（${B.time.length}口）`, `いまの金利は、普通預金が年${pct(M.futsuRate(g))}、1年の定期預金が年${pct(M.teikiRate(g))}。`]); continue; }
    if (id === 'help') {
      await g.say([`いまの金利（大手銀行の目安）は、\n普通預金が年${pct(M.futsuRate(g))}、1年の定期預金が年${pct(M.teikiRate(g))}です。`, '利息には税金がかかります。くわしくは、\n携帯の「銀行」の「金利と税金のこと」にも書いてありますよ。', byEra(g, { showa: '金利は景気で大きく動きます。\n郵便局の貯金とくらべる方も多いですよ。', heisei_early: '金利は、ここ数年ずいぶん下がりました。\n…でも、お金は預けておくのがいちばん安全です。', heisei: 'ゼロ金利のころより、少し上がってきましたが…\nまだまだ、ほんの少しです。', reiwa: 'ここ数年、金利が少しずつ上がってきました。\n貯金も、ちょっと楽しみになりますね。' })], who(CLERK));
      continue;
    }
    if (id === 'loan') { await g.say('カードローンのご相談ですね。\n借りたお金は、利息をつけて返すことになります。\nご利用は計画的に。', who(CLERK)); if (has(g, 'loanCounter')) await g.loanCounter('bank'); continue; }
    if (id === 'log') {
      const lines = B.log.slice(0, 6).map((l) => `${l.day}日目　${l.what}　${l.amount >= 0 ? '+' : '-'}${fmtMoney(Math.abs(l.amount))}`);
      await g.say([atm ? '直近のお取引です。' : (isTecho(g) ? '通帳に記帳しました。' : '明細をお出ししました。'), lines.join('\n')]);
      continue;
    }
    if (id === 'list') {
      for (;;) {
        if (!B.time.length) break;
        const j = await g.list({
          title: '定期預金（A:解約）', cancel: B.time.length,
          items: [...B.time.map((t) => ({ label: `${fmtMoney(t.amount)}（年${pct(t.rate)}）`, right: `満期 ${Math.max(0, t.due - day)}日後` })), { label: 'もどる' }],
          x: 12, y: 44, w: 420, px: true,
        });
        if (j < 0 || j >= B.time.length) break;
        const t = B.time[j];
        const c = await g.ask(`${fmtMoney(t.amount)}の定期預金を、満期前に解約しますか？\n途中で解約すると、普通預金なみの低い金利になります。`, ['解約する', 'やめておく'], { ...who(CLERK), cancel: 1 });
        if (c !== 0) continue;
        tally(B, day);
        const gross = Math.floor((t.amount * M.futsuRate(g)) / 100 * (Math.max(0, day - t.start) / TERM));
        B.time = B.time.filter((x) => x !== t);
        B.bal += t.amount + gross;
        B.interest += gross;
        blog(B, day, '定期預金の中途解約', t.amount + gross);
        g.sfx('coin');
        await g.say(`定期預金を解約しました。\n普通預金に ${fmtMoney(t.amount + gross)} 入りました。`);
      }
      continue;
    }
    if (id === 'in') {
      const max = Math.max(0, g.state.money);
      if (max <= fee) { await g.say('預けられるお金が、ない…。'); continue; }
      const n = await pickAmount(g, '預け入れる金額', max, Math.max(1, fee + 1), fee ? `手数料${fmtMoney(fee)}` : '');
      if (!n || !g.spend(n)) continue;
      tally(B, day);
      if (!B.opened) { B.opened = day; B.nextCredit = day + CREDIT_EVERY; }
      B.bal += n - fee;
      blog(B, day, fee ? `預け入れ（${where}・手数料${fmtMoney(fee)}）` : `預け入れ（${where}）`, n - fee);
      g.sfx('coin');
      passTime(g, atm ? 5 : 15, '銀行');
      await g.say(`普通預金に ${fmtMoney(n - fee)} 預けました。\n残高 ${fmtMoney(B.bal)}`);
      continue;
    }
    if (id === 'out') {
      const max = Math.max(0, B.bal - fee);
      if (max <= 0) { await g.say('引き出せる預金が、ない…。'); continue; }
      const n = await pickAmount(g, '引き出す金額', max, 1, fee ? `手数料${fmtMoney(fee)}` : '');
      if (!n || n + fee > B.bal) continue;
      tally(B, day);
      B.bal -= n + fee;
      g.state.money += n;
      blog(B, day, fee ? `引き出し（時間外手数料${fmtMoney(fee)}）` : `引き出し（${where}）`, -(n + fee));
      g.sfx('coin');
      passTime(g, atm ? 5 : 15, '銀行');
      await g.say(`${fmtMoney(n)}を引き出しました。\n残高 ${fmtMoney(B.bal)}`);
      continue;
    }
    if (id === 'teiki') {
      if (B.bal < TEIKI_MIN) continue;
      const rate = M.teikiRate(g);
      const n = await pickAmount(g, '定期預金にする金額', B.bal, TEIKI_MIN, `1年・年${pct(rate)}`);
      if (!n || n > B.bal) continue;
      const c = await g.ask(`${fmtMoney(n)}を、1年（このゲームでは120日）の定期預金にします。\n年${pct(rate)}。満期までは、普通預金にはもどせません。`, ['つくる', 'やめておく'], { ...who(CLERK), cancel: 1 });
      if (c !== 0) continue;
      tally(B, day);
      B.bal -= n;
      B.time.push({ id: B.nextId++, amount: n, rate, start: day, due: day + TERM });
      blog(B, day, `定期預金へ（年${pct(rate)}）`, -n);
      g.sfx('coin');
      passTime(g, 20, '銀行');
      await g.say(`定期預金をつくりました。\n満期は${day + TERM}日目です。`);
    }
  }
}
const isTecho = (g) => ['showa', 'heisei_early'].includes(eraId(g));
const CLERK = { name: '窓口の行員さん', look: { ...LOOKS.receptionist, top: '#2a4a8a', bottom: '#20305a' } };
const BRANCH = { name: '支店長', look: { ...LOOKS.manager, hair: 'short', hairColor: 'silver', tie: '#2a4a8a' } };

// ====================================================================== ドット銀行
const bankRoom = room(14, 10).set(2, 1, 'w').set(5, 1, 'p').set(8, 1, 'c').set(11, 1, 'w').rect(2, 4, 7, 1, 'T').rect(10, 2, 3, 1, 'A')
  .set(1, 2, 'F').set(12, 5, 'P').set(1, 7, 'S').set(2, 7, 'S').set(10, 6, 'N').set(11, 6, 'N').exit(6, 7);
registerShop({
  id: 'shop_ginko', name: 'ドット銀行 商店街支店', bgm: 'shop_quiet',
  hours: (g) => { const a = atmHours(g); return { ...a, note: a.note }; },
  start: { room: 'main', x: 6, y: 8, dir: 'up' },
  rooms: {
    main: {
      floor: 'floor_marble', wall: 'blue',
      tiles: bankRoom.rows(),
      legend: { T: 'shop_teller', A: 'shop_atm', F: 'cabinet', P: 'plant', S: 'sofa_blue', N: 'table_white' },
      warps: bankRoom.warps(6, 7),
      entities: [
        { ...npc('gk_clerk1', 3, 3, 'down', CLERK.look, CLERK.name, async (g, n) => windowTalk(g, n)), cond: (g) => clerkOpen(g) },
        { ...npc('gk_clerk2', 5, 3, 'down', { ...CLERK.look, hair: 'long', hairColor: 'black' }, '窓口の行員さん', async (g, n) => windowTalk(g, n)), cond: (g) => clerkOpen(g) },
        { ...npc('gk_clerk3', 7, 3, 'down', { ...LOOKS.salaryman, top: '#2a4a8a', tie: '#c9a227' }, '窓口の行員さん', async (g, n) => windowTalk(g, n)), cond: (g) => clerkOpen(g) },
        npc('gk_branch', 11, 4, 'left', BRANCH.look, BRANCH.name, async (g, n) => branchTalk(g, n), { cond: (g) => clerkOpen(g) }),
        npc('gk_guard', 5, 8, 'up', { ...LOOKS.guard, top: '#2a4a8a' }, 'ガードマン', ['いらっしゃいませ。', '番号札をお取りになって、お待ちください。\n窓口は午後3時までですが、ATMは別に使えますよ。'], { wander: 1 }),
        npc('gk_oji', 3, 6, 'right', { ...LOOKS.oldman, top: '#6a7a5a' }, '通帳を持ったおじいさん', async (g) => {
          await g.say(byEra(g, {
            showa: ['年金の振込を見に来たんじゃ。\n通帳に記入してもらうと、安心するのう。', '利息もな、むかしは立派なもんじゃった。\n「預けておけば増える」時代じゃったよ。'],
            heisei_early: ['通帳を見るとな、利息がついておらん。\nうーむ、金利というのは、下がるもんじゃのう。', 'それでも、タンス預金よりはええ。'],
            heisei: ['定期預金の利息が、ジュース一本分でな。\n…それでも、預けておるんじゃ。', '昔は、利息だけで正月が祝えたもんじゃ。'],
            reiwa: ['最近は、金利が上がってきたというのでな。\n通帳を見に来たんじゃ。', '孫に、スマホの口座の作り方を教わっておる。\n…まだ、よくわからん。'],
          }));
        }),
        npc('gk_shufu', 11, 7, 'up', { ...LOOKS.mom, top: '#8ac0a0' }, '買い物帰りの主婦', ['PTAの会費を、おろしに来たの。', '家計のやりくりはね、先取り貯金がコツなのよ。\n月のはじめに、決めた額を分けておくの。']),
      ],
      events: [
        { x: 10, y: 3, w: 3, on: 'action', run: async (g) => { await g.say(byEra(g, { showa: 'キャッシュ・ディスペンサー（CD）とATMのコーナーだ。', any: 'ATMコーナーだ。' })); await bankService(g, { kind: 'atm', where: 'ATM' }); } },
        { x: 10, y: 5, w: 2, on: 'action', run: (g) => g.say(['番号札の発券機と、ご案内のパンフレットが置いてある。', '「はじめての口座づくり」「ご存知ですか？利息の税金」…']) },
        { x: 2, y: 5, w: 7, on: 'action', run: async (g) => { if (!clerkOpen(g)) await g.say('窓口は、もうおわりの時間だ。\n（窓口は平日 9:00〜15:00。ATMコーナーなら使える）'); } },
      ],
      onEnter: async (g) => {
        await firstVisit(g, 'ginko', ['いらっしゃいませ。ドット銀行 商店街支店です。', clerkOpen(g) ? 'お預け入れ・お引き出しは窓口で、' + (isTecho(g) ? '少額ならCD・ATMで。' : 'ATMでも承ります。') : '窓口は終了しましたが、ATMコーナーはご利用いただけます。'], CLERK);
      },
    },
  },
  crime: false,
});
async function windowTalk(g, n) {
  const o = who(n);
  if (!clerkOpen(g)) { await g.say('本日の窓口受付は終了しました。', o); return; }
  const w = 5 + Math.floor(Math.random() * 20);
  passTime(g, w, '銀行の待ち時間');
  await g.say(byEra(g, { showa: '番号札をお取りの方、お待たせしました。', any: 'お待たせしました。ご用件をどうぞ。' }), o);
  await bankService(g, { kind: 'window', where: '窓口' });
  await g.say('ありがとうございました。', o);
}
async function branchTalk(g, n) {
  const o = who(n);
  const B = (await pa())?.appState?.(g).bank;
  const k = await g.ask('支店長の梶原です。\nお金のことで、お困りですか？', ['貯金のコツを聞く', '芸能の仕事とお金', 'なんでもない'], { ...o, cancel: 2 });
  if (k === 0) {
    await g.say(['お金は「使う」「ためる」「殖やす」に分けます。\nまず、生活費の3か月ぶんをためておく。', byEra(g, { showa: 'いまは金利が高いので、定期預金がおすすめです。\n…それでも、使いすぎには注意してくださいね。', heisei_early: '金利は下がりましたが、定期預金は元本が守られます。\n株式や外貨は、値下がりすることもあります。', heisei: '金利は低いままです。投資は、なくなっても困らない\nお金でするのが鉄則ですよ。', reiwa: '金利が上がってきたいまは、定期預金も悪くない。\n投資は、損してもよいお金だけで。' })], o);
    if (B && !B.opened) await g.say('まだ口座をおつくりでないようですね。\n窓口で預け入れをしていただければ、すぐに使えます。', o);
  } else if (k === 1) {
    await g.say(['芸能のお仕事は、収入に波があります。\nあたった月に、余らせてためておくことです。', '家賃と税金の支払いは、待ってくれませんから。\n仕事のない月のぶんを、定期に回しておきましょう。'], o);
  }
}

// ====================================================================== ドット郵便局
const POST_CLERK = { name: '窓口の郵便局員さん', look: { ...LOOKS.clerk, top: '#c8281c', hat: '#c8281c', hair: 'cap' } };
function postage(g) {
  const ym = yearNow(g) * 100 + monthNow(g);
  const tbl = [[198101, 60, 40], [198904, 62, 41], [199401, 80, 50], [201404, 82, 52], [201706, 82, 62], [201910, 84, 63], [202410, 110, 85]];
  let r = tbl[0];
  for (const t of tbl) if (ym >= t[0]) r = t;
  return { letter: r[1], card: r[2] };
}
const yuuchoWord = (g) => (yearNow(g) * 100 + monthNow(g) >= 200710 ? 'ゆうちょ銀行' : '郵便貯金');
const POST_HOURS = { spans: [[T(9), T(17)]], closed: [5, 6], note: '窓口 土日休み' };
registerItem('shop_stamp', { name: '切手（定形）', price: 90, desc: '手紙を出すための切手。\nそのときの定形郵便の料金ぶん。' });
registerItem('shop_hagaki', { name: 'はがき', price: 70, desc: '通常はがき。一言そえて、だれかに出そう。' });
const postRoom = room(13, 9).set(2, 1, 'w').set(5, 1, 'p').set(8, 1, 'c').set(11, 1, 'w').rect(2, 4, 6, 1, 'T').set(10, 2, 'B').set(11, 2, 'B').set(11, 6, 'X').set(1, 6, 'S').set(2, 6, 'S').set(9, 6, 'N').set(1, 2, 'P').exit(5, 6);
registerShop({
  id: 'shop_yubin', name: 'ドット郵便局', bgm: 'shop_quiet',
  hours: POST_HOURS,
  start: { room: 'main', x: 5, y: 7, dir: 'up' },
  rooms: {
    main: {
      floor: 'floor_tile', wall: 'white',
      tiles: postRoom.rows(),
      legend: { T: 'shop_teller_post', B: 'shop_atm', X: 'shop_postbox', S: 'bench', N: 'table_white', P: 'plant' },
      warps: postRoom.warps(5, 6),
      entities: [
        npc('yb_clerk1', 3, 3, 'down', POST_CLERK.look, POST_CLERK.name, async (g, n) => postTalk(g, n)),
        npc('yb_clerk2', 6, 3, 'down', { ...POST_CLERK.look, hair: 'bob', hairColor: 'black', hat: undefined }, '貯金窓口の局員さん', async (g, n) => {
          const o = who(n);
          await g.say(`${yuuchoWord(g)}の窓口です。`, o);
          await bankService(g, { kind: 'window', where: yuuchoWord(g) + 'の窓口' });
        }),
        npc('yb_ojiisan', 2, 7, 'right', { ...LOOKS.oldman, top: '#7a8a6a' }, '年金を受け取るおじいさん', async (g) => {
          await g.say(byEra(g, {
            showa: ['郵便局の貯金は、「定額貯金」が人気じゃった。\n10年預けると、元の倍近くになったもんじゃ。', '手紙も、毎週ここから出しておる。\n孫に、字がきれいだとほめられてな。'],
            heisei_early: ['郵便局はな、こんどの改革で変わるらしい。\nわしには、よくわからんが…。', '定額貯金の金利が、ずいぶん下がってしもうた。'],
            heisei: ['民営化されてな、「ゆうちょ銀行」とか言うんじゃ。\n看板が変わっても、やさしい局員さんは変わらん。', '年賀状は、今年も二百枚書いたぞ。'],
            reiwa: ['年賀状をやめる人が増えたそうじゃ。\n…さみしいのう。', '手紙はいいぞ。\n返事が来るまでの時間が、楽しいんじゃ。'],
          }));
        }),
        npc('yb_haitatsu', 10, 5, 'left', { ...LOOKS.staff, top: '#c8281c', hat: '#c8281c' }, '配達帰りの局員さん', ['赤いバイクで、一日じゅう町をまわるんだ。\n雨の日の配達は、骨が折れるよ。', 'この町の人は、手紙の宛名がきれいな人が多い。\nきちんと書いてあると、うれしくなるんだ。']),
      ],
      events: [
        { x: 10, y: 3, w: 2, on: 'action', run: async (g) => { await g.say(`${yuuchoWord(g)}のATMだ。`); await bankService(g, { kind: 'atm', where: yuuchoWord(g) + 'ATM' }); } },
        { x: 11, y: 6, on: 'action', run: (g) => g.say(['赤いポストだ。', '「集荷 本日の最終は17時」と書いてある。']) },
        { x: 9, y: 6, on: 'action', run: (g) => g.say(['記入台だ。宛名の書き方の見本が貼ってある。', '「住所は、ていねいに。切手は右上に」']) },
      ],
      onEnter: async (g) => {
        await firstVisit(g, 'yubin', ['いらっしゃいませ。ドット郵便局です。', byEra(g, { showa: '切手・はがきのご用や、郵便貯金は窓口へどうぞ。', heisei: '切手・はがき、ゆうちょのご用は窓口へどうぞ。' })], POST_CLERK);
      },
    },
  },
  crime: false,
});
async function postTalk(g, n) {
  const o = who(n);
  const pg = postage(g);
  const nenga = monthNow(g) === 12;
  const rows = [
    { id: 'letter', label: '手紙・はがきを出す', right: `はがき ${real(pg.card)}` },
    ...(nenga ? [{ id: 'nenga', label: '年賀状を出す（12月）', right: `1枚 ${real(pg.card)}` }] : []),
    { id: 'kakitome', label: '現金書留で仕送り（実家へ）' },
    { id: 'stamp', label: '切手・はがきを買う', right: `${real(pg.letter)}/${real(pg.card)}` },
    { id: 'info', label: '郵便料金のこと' },
    { id: 'end', label: 'やめる' },
  ];
  const k = await g.list({ title: 'ドット郵便局 窓口', items: rows.map((r) => ({ label: r.label, right: r.right || '' })), cancel: rows.length - 1, x: 12, y: 44, w: 440, px: true });
  if (k < 0 || rows[k].id === 'end') { await g.say('またどうぞ。', o); return; }
  const id = rows[k].id;
  if (id === 'info') {
    await g.say([`いまの郵便料金は、定形郵便（25gまで）が${real(pg.letter)}、はがきが${real(pg.card)}です。`, byEra(g, { showa: '郵便番号は、5けたです。宛名の右上に、忘れずに書いてくださいね。', heisei_early: (yearNow(g) * 100 + monthNow(g) < 199802 ? '郵便番号は、いまは5けたです。もうすぐ7けたに変わると聞きました。' : '郵便番号が、7けたになりました。住所のあたまに書いてくださいね。'), heisei: '民営化後も、全国どこでも同じ料金でお届けします。', reiwa: '料金は上がりましたが、手書きの手紙は、また見直されているんですよ。' })], o);
    return;
  }
  if (id === 'stamp') {
    await g.say('どちらをお求めですか。', o);
    const n1 = await g.ask('どちらにする？', [`切手（定形）${real(pg.letter)}`, `はがき ${real(pg.card)}`, 'やめる'], { cancel: 2 });
    if (n1 === 0 || n1 === 1) {
      const cost = toInternal(n1 === 0 ? pg.letter : pg.card);
      if (!g.spend(cost)) { await g.say('お金が足りない…。'); return; }
      g.giveItem(n1 === 0 ? 'shop_stamp' : 'shop_hagaki', 1, true);
      g.sfx('coin');
      await g.say(`${n1 === 0 ? '切手' : 'はがき'}を1枚買った。`);
    }
    return;
  }
  // letters: to whom
  const S = SS(g);
  const friends = (has(g, 'friends') ? g.friends(2) : []).slice(0, 12);
  let fam = [];
  try { fam = MODS.family && MODS.family.familyMembers ? MODS.family.familyMembers(g) : []; } catch (e) { console.error(e); fam = []; }
  const people = [];
  for (const M of fam) people.push({ id: M.pid, name: M.label || M.call || M.pid, fam: true });
  for (const f of friends) { const P = MODS.people && MODS.people.PEOPLE[f]; if (P && !people.some((p) => p.id === f)) people.push({ id: f, name: P.short || P.name }); }
  if (id === 'kakitome') {
    const M = fam[0];
    if (!M || !MODS.family || typeof MODS.family.sendMoney !== 'function') { await g.say('（送る相手が、いないようだ…）'); return; }
    if (dayN(g, 'kakitome') >= 1) { await g.say('今日はもう、仕送りの書留を出した。\n（続けて送っても、気持ちは同じ。…また今度に）', o); return; }
    const fee = toInternal(byEra(g, { showa: 450, heisei_early: 480, heisei: 500, reiwa: 520 }));
    const amounts = [5000, 10000, 30000];
    const j = await g.list({ title: `現金書留で仕送り（書留料など ${fmtMoney(fee)}）`, items: [...amounts.map((a) => ({ label: fmtMoney(a), right: M.label || '', disabled: g.state.money < a + fee })), { label: 'やめる' }], cancel: amounts.length, x: 12, y: 44, w: 420, px: true });
    if (j < 0 || j >= amounts.length) return;
    if (g.state.money < amounts[j] + fee) { await g.say('お金が足りない…。'); return; }
    g.spend(fee);
    const r = MODS.family.sendMoney(g, M.pid, amounts[j]);
    bumpN(g, 'kakitome');
    passTime(g, 20, '郵便局');
    await g.say(r ? ['現金書留の封筒に、お金と手紙を入れて、窓口に出した。', '「ちゃんと届きますよ」と、局員さんが受領証をくれた。'] : '（うまく送れなかったようだ…）');
    return;
  }
  if (id === 'nenga') {
    const year = yearNow(g);
    if (S.nenga === year) { await g.say('今年の年賀状は、もう出した。\n（お正月に、返事が楽しみだ）', o); return; }
    const targets = people.slice(0, 5);
    if (!targets.length) { await g.say('年賀状を出す相手が、まだいない…。\n（仲のいい人ができたら、また来よう）'); return; }
    const each = toInternal(pg.card);
    const total = each * targets.length;
    const c = await g.ask(`年賀状を${targets.length}枚出しますか？\n宛先：${targets.map((t) => t.name).join('・')}\n（はがき代 ${fmtMoney(total)}）`, ['出す', 'やめる'], { cancel: 1 });
    if (c !== 0) return;
    if (!g.spend(total)) { await g.say('お金が足りない…。'); return; }
    S.nenga = year;
    for (const t of targets) g.addAff(t.id, 2, true);
    g.relax({ stress: 6 });
    passTime(g, 40, '年賀状');
    g.sfx('good');
    await g.say([`ひとことずつ添えて、年賀状を${targets.length}枚書いた。`, '元日に届くように、12月25日までに出すのがきまり。\n（それぞれ、♥ +2　ストレス -6）']);
    return;
  }
  // 手紙・はがき
  if (!people.length) { await g.say('手紙を出す相手が、まだいない…。\n（友だちや、家族に出せる）'); return; }
  const j = await g.list({ title: 'だれに出す？（はがき1枚）', items: [...people.map((p) => ({ label: p.name, right: p.fam ? '家族' : '' })), { label: 'やめる' }], cancel: people.length, x: 12, y: 44, w: 360, px: true });
  if (j < 0 || j >= people.length) return;
  const to = people[j];
  const key = 'letter_' + to.id;
  if (S[key] && g.state.day - S[key] < 8) { await g.say(`${to.name}には、このあいだ出したばかり。\n（8日ほど、あけよう）`, o); return; }
  const cost = toInternal(pg.card);
  if (!g.spend(cost)) { await g.say('お金が足りない…。'); return; }
  S[key] = g.state.day;
  g.addAff(to.id, 2, true);
  g.relax({ stress: 4 });
  passTime(g, 20, '手紙');
  g.sfx('good');
  await g.say([`${to.name}へ、近況をひとこと書いて、はがきを出した。`, byEra(g, { showa: '電話もいいけれど、書いた字には、気持ちが残る。', heisei_early: 'ポケベルも便利だけれど、はがきは、たまに出すからうれしい。', heisei: 'メールもいいけれど、はがきは、手元に残る。', reiwa: 'メッセージもいいけれど、手書きは、特別に届く。' }), '（♥ +2　ストレス -4）']);
}

// ====================================================================== 駅前交番
const COP = { name: '駅前交番の巡査長', look: { ...POLICE, glasses: false, skin: 'tan' } };
const TOWNS = { machi: 'このドット商店街', tokyo: '東京エリア', minato: 'テレビ局エリア', nagatacho: '永田町', kanraku: 'ネオン街', namba: '大阪のなんば' };
const DIRW = (dx, dy) => {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const h = dx > 0 ? '東' : '西', v = dy > 0 ? '南' : '北';
  if (ax < 3 && ay >= 3) return v;
  if (ay < 3 && ax >= 3) return h;
  return v + h;
};
const TOWN_ROUTE = {
  machi: 'ここが、ドット商店街だよ。アーケード、駅前、区役所、横丁、公園、住宅街…ぐるっと歩いてみるといい。',
  tokyo: '東京エリアなら、大通りを東へまっすぐ。歩いて十分ほどで、西のはしに出るよ。\n東京駅前まで、バス（¥210）も出ている。',
  minato: 'テレビ局エリアは、大通りを東へ、東京エリアを抜けたさらに先だ。\nバス（¥210）が、いちばん楽だね。',
  nagatacho: '永田町は、東京エリアのまん中の通りを北へまっすぐ。\nまずは、大通りを東へ、東京エリアまで行くといい。',
  kanraku: 'ネオン街は、東京エリアのまん中の通りを南へまっすぐ。\n…夜の街だ。客引きには、ついていかないこと。',
  namba: '大阪のなんばなら、東京駅から新幹線だ。\n駅前から電車に乗って、東京駅へ。お金は、多めに持っていくといい。',
};
function routeText(g, id, selfId) {
  if (TOWN_ROUTE[id]) return TOWN_ROUTE[id];
  const G = GUIDE[id] || {};
  const there = doorIndexFor(id);
  const here = doorIndexFor(selfId);
  const name = G.name || (PLACES[id] && PLACES[id].name) || id;
  if (!there || !here) return `${name}かい？\n${G.hint || 'このあたりの人に聞いてみるといい。'}`;
  if (there.town === here.town) {
    const dx = there.x - here.x, dy = there.y - here.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist < 4) return `${name}は、すぐそこ。この交番の目と鼻の先だよ。`;
    return `${name}なら、ここから${DIRW(dx, dy)}へ。\n歩いて${Math.max(1, Math.ceil(dist / 8))}分ほどだ。${G.hint ? '\n（' + G.hint + '）' : ''}`;
  }
  const tn = TOWNS[there.town] || there.town;
  if (there.town === 'namba') return `${name}は${tn}だね。\n東京駅から新幹線と電車で行くことになる。${G.hint ? '\n（' + G.hint + '）' : ''}`;
  return `${name}は、${tn}にある。\n商店街の東のはしの大通りから行けるよ。東京駅前から出るバス（¥210）も便利だ。${G.hint ? '\n（' + G.hint + '）' : ''}`;
}
async function kobanDirections(g, o) {
  const ids = GUIDE_ORDER.filter((id) => GUIDE[id] && !GUIDE[id].secret && PLACES[id] && id !== 'shop_koban' && (g.state.flags.visited && g.state.flags.visited[id] || ['tokyo', 'machi', 'minato', 'namba', 'station_tokyo', 'konbini', 'home', 'kuyakusho', 'nagatacho', 'kanraku'].includes(id)));
  if (!ids.length) { await g.say('このへんの地図なら、そこの壁に貼ってあるよ。', o); return; }
  const i = await g.list({ title: 'どこへ行きたい？', items: ids.map((id) => ({ label: GUIDE[id].name })), x: 12, y: 44, w: 380, px: true });
  if (i < 0) return;
  await g.say(routeText(g, ids[i], 'shop_koban'), o);
  passTime(g, 3, '道を聞く');
}
async function kobanLost(g, o) {
  if (g.hasItem && g.hasItem('kanraku_wallet')) {
    await g.say(['財布を拾ったのかい。ありがとう。\nこの「拾得物件預り書」に、拾った場所を書いてね。', '落とし主が見つかったら、連絡がいく。\nお礼の「報労金」は、中身の5〜20%が目安だ。', `${yearNow(g) * 100 + monthNow(g) >= 200712 ? '3か月' : '6か月'}たっても落とし主が出なければ、拾った人のものになる。`], o);
    g.takeItem('kanraku_wallet');
    const f = g.state.flags.kanraku && typeof g.state.flags.kanraku === 'object' ? g.state.flags.kanraku : (g.state.flags.kanraku = {});
    f.walletIn = g.state.day;
    g.sfx('ok');
    g.notify('拾った財布を、交番に届けた', { color: '#ffd23f' });
    return;
  }
  const k = await g.ask('落とし物かい？', ['物をなくした', '拾った物がある', 'ちがう'], { ...o, cancel: 2 });
  if (k === 0) {
    const list = byEra(g, { showa: ['傘', '手袋', '定期入れ', 'カメラ'], heisei_early: ['傘', 'ポケベル', '定期入れ', 'テレカ'], heisei: ['傘', 'ケータイ', 'ICカード', 'イヤホン'], reiwa: ['傘', 'スマホ', 'ICカード', 'ワイヤレスイヤホン'] });
    await g.say([`何をなくしたのかな。…ふむ、いまのところ\nそれらしい届けは出ていないね。`, `ここで預かっているのは、${list.join('、')}…\n毎日ふえるけれど、持ち主が取りに来るのは、半分ほどだ。`, '遺失届を書いておくから、見つかったら連絡するよ。'], o);
  } else if (k === 1) await g.say('そうかい。拾った物は、中身をいじらずに\nそのまま持ってきてくれれば、ちゃんと預かるよ。\n（財布は、財布のまま。それが大事だ）', o);
}
async function kobanConsult(g, o) {
  const items = ['闇金・借金のこと', 'つきまとい・ストーカー', '暴力団のこと', 'やめる'];
  const k = await g.ask('どんな相談かな？\n（話した内容の秘密は守るよ）', items, { ...o, cancel: 3 });
  if (k === 0) {
    const j = g.state.justice;
    const yami = j && (j.loans || []).some((l) => l.lender === 'yamikin' && l.status !== 'void' && l.status !== 'paid');
    if (yami && has(g, 'policeConsult')) { await g.policeConsult('yamikin'); return; }
    await g.say(['登録のない業者が、法外な利息で貸すのが「闇金」。\n10日で1割の「トイチ」なんて、立派な犯罪だ。', yearNow(g) >= 2006 ? '借金のことは、法テラスや区役所の相談窓口へ。\n警察の生活安全課でも、闇金の相談は受けている。' : '借金のことは、消費生活センターや弁護士会の窓口へ。\n闇金は、警察の生活安全課に相談しなさい。', 'ひとりで抱えこまないこと。\n返せなくなる前に、相談するのがいちばんだ。'], o);
    return;
  }
  if (k === 1) {
    await g.say(['同じ人物から、手紙や連絡が続くのかい。\nそれは「つきまとい」――ストーカー規制法の対象かもしれない。', yearNow(g) >= 2000 ? 'ストーカー規制法は、2000年にできた。\n警察から相手に「警告」を出すこともできる。' : '法律はまだ整っていないが、「迷惑防止」の面から相談に乗れる。', '手紙やメッセージは、消さずに残しておくこと。\n帰り道は、ひとりで歩かないようにね。'], o);
    return;
  }
  if (k === 2) {
    const f = g.state.flags.kanraku;
    if (f && typeof f === 'object' && f.kumiTies && !f.kumiCut) {
      f.kumiCut = g.state.day;
      f.kumiPressure = 0;
      g.addNeed('stress', -10);
      await g.say(['…鬼灯組と関わってしまったんだね。\n正直に話してくれて、ありがとう。', '警察と「暴力追放運動推進センター」が、あなたを守る。\n連絡は絶って、何か言ってきたらすぐ知らせなさい。'], o);
      return;
    }
    await g.say(['暴力団の誘いは、きっぱり断ること。\n「ちょっと手伝え」――一度でも受けたら、抜けられなくなる。', '芸能の仕事をしているなら、なおさらだ。\nつながりが明るみに出ただけで、契約も、出演も、失う。'], o);
  }
}
let JISHU = null;
async function kobanJishu(g, o) {
  const M = MODS.crime;
  const j = g.state.justice;
  if (!M) { await g.say('…自首、ですか？\n詳しくは、警察署で聞きます。', o); return false; }
  if (!j || !has(g, 'arrest')) { await g.say('…自首、ですか？\n詳しくは、警察署で聞きます。', o); return false; }
  if (j.status === 'detained' || j.status === 'prison') return false;
  const ids = Object.keys(j.heat || {}).filter((id) => M.CRIMES[id] && M.CRIMES[id].kind === 'crime' && !(j.cases || []).some((c) => !c.closed && c.crime === id));
  if (!ids.length) { await g.say(['自首…？', '話を聞くかぎり、事件にあたるようなことは\nなさそうだね。困りごとなら、相談に乗るよ。'], o); return false; }
  const names = ids.map((id) => M.CRIMES[id].name).concat(['やっぱりやめる']);
  const k = await g.ask('（どのことを話そう…）', names, { cancel: names.length - 1 });
  if (k < 0 || k >= ids.length) { await g.say('（言い出せなかった…）'); return false; }
  const id = ids[k];
  if (id === 'tax_evasion') { await g.say('税金の申告のことなら、まず税務署へ。\n自分から修正申告をすれば、扱いが軽くなることもある。', o); return false; }
  const h = j.heat[id];
  const known = !!(h && h.queued) || (j.queue || []).some((e) => e.crime === id);
  const c = await g.ask([`${M.CRIMES[id].name}の件、だね。`, known ? '…その件は、もう捜査が始まっているようだ。\nそれでも、自分から来たことはちゃんと伝える。' : '捜査機関に知られる前に、自分から申し出ることを\n「自首」という。刑が軽くなることもある。', '本当に、話すのかい？'], ['自首する', 'やめておく'], { ...o, cancel: 1 });
  if (c !== 0) { await g.say('…わかった。気持ちが決まったら、また来なさい。', o); return false; }
  if (h) h.queued = true;
  j.queue = (j.queue || []).filter((e) => !(e.crime === id && ['arrest', 'summons', 'weekly'].includes(e.type)));
  JISHU = { id, day: g.state.day, legal: !known };
  await g.say('（しばらくして、警察署から刑事がやって来た…）');
  const sev = M.CRIMES[id].severity || 2;
  await g.arrest(id, { via: 'warrant', evidence: 0.92, amount: h ? h.amount : 0, injury: h ? h.injury : false, request: h ? h.request : undefined, plea: 'admit', askPlea: false, skipArrestScene: true, zaitaku: sev <= 2, source: '自首' });
  JISHU = null;
  return true;
}
import('../engine/crime.js').then((M) => {
  if (typeof M.onJustice !== 'function') return;
  M.onJustice('arrested', (g, info) => {
    try {
      if (!JISHU || !info || info.crime !== JISHU.id || g.state.day - JISHU.day > 1) return;
      const j = g.state.justice;
      const cs = j && (j.cases || []).find((c) => c.id === info.caseId);
      if (cs) { cs.remorse = Math.max(cs.remorse || 0, JISHU.legal ? 1.5 : 1); cs.jishu = JISHU.legal ? 'jishu' : 'shuto'; cs.plea = 'admit'; }
      JISHU = null;
    } catch (e) { console.error(e); }
  });
}).catch(() => {});
async function kobanTalk(g, npcE) {
  const o = who(npcE);
  const S = SS(g);
  if (!S.met.koban_cop) {
    S.met.koban_cop = 1;
    await g.say(['駅前交番の杉山です。', byEra(g, { showa: '道案内、落とし物、困りごと――なんでも聞いてください。', any: '道案内、落とし物、困りごと――なんでもどうぞ。' })], o);
  }
  // the 手配度: a wanted face may be stopped (once a day)
  let stars = 0;
  try { stars = has(g, 'wantedStars') ? g.wantedStars() : 0; } catch (e) { stars = 0; }
  if (stars >= 2 && dayN(g, 'koban_stop') < 1 && has(g, 'shokushitsu')) {
    bumpN(g, 'koban_stop');
    if (Math.random() < 0.18 + 0.12 * stars) {
      await g.say(['…君、ちょっといいかな。', 'どこかで見たような顔だ。\n手配書の写真に、似ている気がしてね。'], o);
      const r = await g.shokushitsu({});
      if (r === 'arrested' || r === 'held') return;
    } else await g.say('（巡査長が、ちらりとこちらを見た。\n…気づかれたかもしれない）');
  }
  for (let guard = 0; guard < 10; guard++) {
    const rows = ['道を聞く', '落とし物', '相談したい', '自首したい', 'なんでもない'];
    const k = await g.ask('どうしました？', rows, { ...o, cancel: 4 });
    if (k < 0 || k === 4) { await g.say(byEra(g, { showa: '気をつけて。\n夜道は明るいところを歩くんだよ。', any: 'お気をつけて。\n何かあったら、すぐ110番を。' }), o); return; }
    if (k === 0) await kobanDirections(g, o);
    if (k === 1) await kobanLost(g, o);
    if (k === 2) await kobanConsult(g, o);
    if (k === 3 && (await kobanJishu(g, o))) return;
  }
}
const kobanRoom = room(11, 8).set(2, 1, 'm').set(4, 1, 'w').set(8, 1, 'P').set(6, 1, 'c').rect(3, 3, 4, 1, 'D').set(1, 3, 'L').set(9, 3, 'K').set(2, 5, 'h').set(3, 5, 'h').set(7, 5, 'h').set(8, 5, 'h').exit(4, 5);
registerShop({
  id: 'shop_koban', name: '駅前交番', bgm: 'office',
  start: { room: 'main', x: 4, y: 6, dir: 'up' },
  rooms: {
    main: {
      floor: 'koban_floor', wall: 'cream',
      tiles: kobanRoom.rows(),
      legend: { m: 'wall_cream+koban_map', P: 'wall_cream+koban_poster', D: 'koban_desk', L: 'koban_shelf', K: 'locker', h: 'chair' },
      warps: kobanRoom.warps(4, 5),
      entities: [
        npc('kb_cop', 4, 2, 'down', COP.look, COP.name, async (g, n) => kobanTalk(g, n), { fixedDir: true }),
        npc('kb_cop2', 6, 2, 'down', { ...POLICE, skin: 'light', hair: 'cap' }, '若い巡査', ['（書類を書いている）', 'パトロールから戻ったところです。\n駅前は、人が多いぶん、落とし物も多いんですよ。', '自転車の盗難や、酔っぱらいの保護…\n駅前の交番は、一日じゅう大いそがしです。'], { fixedDir: true }),
        npc('kb_obaa', 8, 6, 'up', { ...LOOKS.oldwoman, top: '#5a8ac8' }, '道をたずねに来たおばあさん', ['孫の家をさがしておるんじゃが、\n駅の反対側に出てしもうてのう。', 'おまわりさんが、地図に丸をつけてくれたよ。\nありがたいことじゃ。']),
        sign(2, 1, ['ドット商店街の地図だ。', '駅・アーケード・区役所・銀行・郵便局・横丁・公園・住宅街…\n赤い丸は「自転車の盗難に注意」の場所らしい。']),
        sign(8, 1, ['ポスターが貼ってある。', '「自転車は鍵を二つ」「振り込め詐欺にご注意」\n「指名手配被疑者の情報をお寄せください」']),
        sign(9, 2, ['落とし物の棚だ。', '傘、手袋、定期入れ、鍵…\n一つひとつに、拾われた日と場所の札がついている。']),
      ],
      onEnter: (g) => firstVisit(g, 'koban_m', ['はい、こんにちは。どうしました？', '道案内、落とし物、相談…なんでもどうぞ。'], COP),
    },
  },
  crime: false,
});
