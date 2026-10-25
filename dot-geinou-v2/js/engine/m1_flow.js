// M-1グランプリ — the player's flows: エントリー (用紙・参加費・エントリーナンバー・確認のメール/ハガキ), each 予選 round
// (受付・楽屋・出囃子確認・リハーサル/場当たり・舞台裏稽古・ネタ合わせ・ネタ選び・舞台袖・本番・結果発表・審査コメント),
// 決勝進出者発表, 敗者復活戦, the final (審査員・笑神籤・紹介VTR・採点・暫定ボックス・最終決戦・優勝), and after it
// (世界最速大反省会・打ち上げ・アフター座談会・アナザーストーリー・リターンズ・ツアー・DVD). Watching the final at home when
// the player is not in it. Every long flow: the first time in full, then 「おまかせ」 to go faster.
// Other modules only through feature-detected g.* calls (CONTRACT4).

import { askText } from './textinput.js';
import { MINIGAMES } from './minigame.js';
import { ITEMS } from './state.js';
import { m1Rules, M1, MC, FARE, ORIGINS, SHORTFALL_LINES, judgesFor, h01, pickH, comboName, lookFor } from './m1_data.js';
import { fieldOf, scoresOf, cutOf, passedOf, prepareFinal, runRevival, finalOrder, actOf, scoreCard, finalScore, finalVotes,
  recordHistory, stars, copyFor, comboAct, anonCombo, sd, simulateFinal } from './m1_field.js';
import { pushSet, popSet, card, bigText, kujiCard, pvCard, revealScores, votesCard, championCard, netCard, docPage, dvdCard,
  formScreen, boardScreen } from './m1_ui.js';
import { has, safe, cal, dateLabel, dateLabelY, today, M, season, entryOf, plan, statusOf, unitInfo, powerOf, qualityOf, odds,
  internal, yenNom, news, msg } from './m1_core.js';

const STAFF = { name: 'M-1事務局', look: MC.staff.look };
const sleepy = (g, ms) => (g.auto ? Promise.resolve() : g.wait(ms));
const sfx = (g, k) => { if (!g.auto) g.sfx(k); };
const say = (g, t, who = null) => g.say(t, who ? { name: who.name, look: who.look } : {});
const ask = (g, t, ch, who = null, o = {}) => g.ask(t, ch, { ...(who ? { name: who.name, look: who.look } : {}), ...o });
const partnerWho = (u) => (u && u.partnerName ? { name: u.partnerName, look: u.partnerLook } : null);
const ROUND_LOOK = { pressure: [22, 32, 42, 55, 70], size: ['small', 'small', 'theater', 'theater', 'hall'], crowd: ['cold', 'normal', 'normal', 'warm', 'tough'] };
const STAMINA = [18, 20, 22, 24, 28];

// ================================================================ helpers
function homeCity(g) { const h = safe(() => g.housing(), null); return h && /namba|osaka/.test(String(h.place || '')) ? '大阪' : '東京'; }
function logLine(E, s) { if (!E) return; E.log = E.log || []; E.log.push(s); if (E.log.length > 60) E.log.splice(0, E.log.length - 60); }
// the player's act as entered (the members and looks of the entry, even if the act changed since)
function castOf(g, y, E) {
  const u = unitInfo(g, y);
  if (E && Array.isArray(E.cast) && E.cast.length >= 2 && (u.members.length < 2 || u.partner !== E.partner)) return E.cast.map((x) => ({ ...x, look: x.id === 'player' ? g.state.look : x.look }));
  return u.members.slice(0, 3).map((x) => ({ id: x.id, name: x.short || x.name, role: x.role, look: x.look }));
}
function meAct(g, y, E) {
  const m = M(g), u = unitInfo(g, y);
  const src = u.source === 'net' ? 'net' : u.source === 'nsc' ? 'nsc_tokyo' : u.amateur ? 'amateur' : 'other';
  return {
    key: 'me', name: E ? E.name : u.name, me: true, members: castOf(g, y, E).map((x, i) => ({ name: x.name, role: x.role === 'boke' ? 'ボケ' : x.role === 'tsukkomi' ? 'ツッコミ' : i ? 'ツッコミ' : 'ボケ', look: x.look })),
    years: u.years, formed: u.formedYear, agency: u.agencyName, origin: src, region: homeCity(g), style: m.me.style || 'しゃべくり',
    tags: [], power: powerOf(g), last: !!u.last, amateur: u.amateur, finals: m.me.finals || 0, semis: m.me.semis || 0, ru: m.me.ru || 0,
  };
}
// The mode of a long flow: 0 = in full, 1 = おまかせ (prep), 2 = すべておまかせ (also the performance)
async function chooseMode(g, key, label) {
  const m = M(g);
  if (!m.seen[key]) { m.seen[key] = true; return 0; }
  const i = await ask(g, `${label}\n（何度目かの${label.replace(/[。！]$/, '')}だ。どう進める？）`, ['ひとつずつ進める', 'おまかせ（準備はおまかせ・本番は自分で）', 'すべておまかせ（本番もおまかせ）'], null, { cancel: 0 });
  return Math.max(0, i);
}
async function doPerform(g, o) {
  const opts = { kind: 'manzai', neta: o.neta || undefined, length: o.length, title: o.title,
    venue: { name: o.venueName, size: o.size || 'theater', crowd: o.crowd || 'normal', pressure: o.pressure ?? 50 },
    contest: { id: 'm1', round: o.round, name: o.contestName }, skip: !!o.skip };
  let r = null;
  if (has(g, 'perform')) r = await (async () => { try { return await g.perform(opts); } catch (e) { console.error(e); return null; } })();
  if (!r && has(g, 'performSim')) r = safe(() => g.performSim({ ...opts, power: powerOf(g), quality: qualityOf(g, o.neta) }), null);
  if (!r) {
    const id = MINIGAMES.manzai ? 'manzai' : 'tsukkomi';
    const res = await g.minigame(id, { difficulty: 3, skill: 'warai', title: o.title });
    r = { score: res.score, rank: res.rank };
  }
  const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return { score: Math.max(0, Math.min(100, Math.round(n(r.score, 40)))), rank: r.rank || 'C', laughs: n(r.laughs), big: n(r.big), flubs: n(r.flubs), blanks: n(r.blanks), overtime: n(r.overtime), adlib: n(r.adlib), parts: r.parts || {}, comment: r.comment || '', highlights: Array.isArray(r.highlights) ? r.highlights : [], heat: Array.isArray(r.heat) ? r.heat : [] };
}
// The player's ネタ: g.pickNeta (B) → the ネタ帳 → this game's own 「いつものネタ」 (when B is not there)
function houseNeta(g) {
  const m = M(g);
  if (!m.house) m.house = { id: 'm1house', title: 'いつもの漫才', practice: 20 };
  const stat = has(g, 'comedyStat') ? safe(() => g.comedyStat('neta'), 20) : 20;
  const total = Math.round(Math.min(95, 28 + stat * 0.55));
  return { id: 'm1house', house: true, kind: 'manzai', title: m.house.title, length: 240, lines: [], ai: { total, axes: {}, comments: [], judges: [], by: 'local', day: today(g) }, practice: m.house.practice, uses: m.house.uses || {} };
}
async function chooseNeta(g, len, title, exclude = null, mode = 0) {
  let n = null;
  if (has(g, 'pickNeta') && mode < 2) n = await (async () => { try { return await g.pickNeta({ kind: 'manzai', length: len, title, forContest: 'm1' }); } catch (e) { console.error(e); return null; } })();
  if (n && exclude && n.id === exclude) {
    await say(g, '（さっきと同じネタだ…。最終決戦で同じネタは評価が下がる）');
  }
  if (!n && has(g, 'netaList')) {
    const list = (safe(() => g.netaList('manzai'), []) || []).filter((x) => x && x.id !== exclude);
    if (list.length === 1 || (list.length && (mode >= 1 || g.auto))) n = list[0];
    else if (list.length > 1) {
      const i = await g.list({ title: 'どのネタでいく？', items: list.slice(0, 8).map((x) => ({ label: x.title || '無題', right: `${Math.round(x.length || 0)}秒` })), x: 8, y: 8, w: 200, describe: (k) => { const x = list[k]; return x ? `仕上がり${Math.round(x.practice || 0)}・${x.ai ? `AI採点${x.ai.total}点` : '未採点'}` : ''; } });
      n = list[Math.max(0, i)] || list[0];
    }
  }
  if (!n) {
    const h = houseNeta(g);
    if (exclude === h.id) { const q = Math.max(20, h.ai.total - 8); n = { ...h, id: 'm1house2', title: '二本目の漫才', ai: { ...h.ai, total: q }, practice: Math.round(h.practice * 0.6) }; } else n = h;
  }
  return n;
}
function practice(g, neta, n) {
  if (!neta) return 0;
  if (neta.house) { const m = M(g); m.house.practice = Math.min(100, (m.house.practice || 0) + n); neta.practice = m.house.practice; return neta.practice; }
  if (has(g, 'practiceNeta')) return safe(() => g.practiceNeta(neta.id, n), 0);
  return 0;
}
// a ネタ seen at an earlier M-1 (another year) is 「去年と同じ」: reusing it in the rounds of the same year is normal
function markUsed(g, neta, y) {
  if (!neta) return;
  const m = M(g);
  m.me.netaYears = m.me.netaYears || {};
  m.me.netaYears[neta.id] = y;
  if (!neta.house && has(g, 'markNetaUsed')) safe(() => g.markNetaUsed(neta.id, 'm1'));
}
function usedBefore(g, neta, y) {
  if (!neta) return false;
  const ny = M(g).me.netaYears || {};
  return Number.isFinite(ny[neta.id]) && ny[neta.id] < y;
}
function reasonLines(g, res, need = 55) {
  const out = [];
  if (res.overtime > 0) out.push(SHORTFALL_LINES.overtime[0]);
  if (res.flubs > 1) out.push(SHORTFALL_LINES.flub[0]);
  if (res.blanks > 0) out.push(SHORTFALL_LINES.blank[0]);
  const P = res.parts || {};
  const low = Object.entries({ neta: P.neta, ma: P.timing, voice: P.execution, chara: P.presence, crowd: P.crowd }).filter(([, v]) => Number.isFinite(v) && v < need).sort((a, b) => a[1] - b[1]);
  for (const [k] of low.slice(0, 2)) if (SHORTFALL_LINES[k]) out.push(pickH(SHORTFALL_LINES[k], g.state.day, k));
  if (has(g, 'shortfall')) {
    const sf = safe(() => g.shortfall('manzai', need), null);
    if (sf && Array.isArray(sf.gaps)) for (const gp of sf.gaps.slice(0, 2)) { const L = SHORTFALL_LINES[gp.key]; if (L) out.push(`${pickH(L, gp.key, g.state.day)}（${gp.label} ${gp.have}／目安${gp.need}）`); }
  }
  if (res.heat && res.heat.length && res.heat[0] < 40) out.push(SHORTFALL_LINES.tsukami[0]);
  if (!out.length) out.push('全体的に、決め手に欠けた。もう一段、強いボケと構成がほしい。');
  return [...new Set(out)].slice(0, 3);
}
function rewards(g, kind, n) {
  const R = { r1: [4, 30], r2: [10, 80], r3: [20, 200], qf: [40, 500], sf: [80, 1200], final: [400, 6000], top3: [300, 4000], champ: [1500, 30000], ru: [400, 8000] }[kind] || [0, 0];
  g.addFame(R[0] * (n || 1), true);
  g.addFans(R[1] * (n || 1), true);
  if (has(g, 'addStageExp')) safe(() => g.addStageExp('manzai', kind === 'champ' || kind === 'final' ? 3 : 1));
}
function tick(g, stamina, stress = 8) {
  const st = g.state;
  const ok = st.stamina >= stamina;
  st.stamina = Math.max(0, st.stamina - stamina);
  if (st.life) st.life.workDay = st.day;
  safe(() => g.lifeTick({ hunger: -10, stress, clean: -6 }));
  return ok;
}

// ================================================================ entry
export async function entryFlow(g) {
  const m = M(g);
  const c = cal(g), y = c.year;
  const S = statusOf(g, y);
  const rules = m1Rules(y);
  if (!rules) { await say(g, S.label); return null; }
  const P = plan(g, y);
  const t = today(g);
  const E0 = entryOf(g, y);
  if (E0) { await say(g, [`${rules.label}にはエントリー済みだ。`, `エントリーナンバー ${E0.no}　「${E0.name}」\n${E0.next ? `次は${P.rounds[E0.next.ri].name}：${dateLabel(g, E0.next.day)} ${E0.next.city}（${E0.next.hall}）` : statusText(E0)}`]); return E0; }
  if (t < P.entryFrom) { await say(g, `${rules.label}のエントリーは、${dateLabel(g, P.entryFrom)}から。`); return null; }
  if (t > P.entryTo) { await say(g, `${rules.label}のエントリーは締め切られた（${dateLabel(g, P.entryTo)}まで）。`); return null; }
  const u = unitInfo(g, y);
  const mode = m.seen.entry ? 1 : 0;
  m.seen.entry = true;
  const set = pushSet(g, 'uketsuke', { year: y, sub: 'エントリー受付', cast: [{ look: MC.staff.look, x: 320, y: 168, s: 2 }, { look: g.state.look, x: 260, y: 236, s: 2, dir: 'up' }].concat(u.partnerLook ? [{ look: u.partnerLook, x: 380, y: 236, s: 2, dir: 'up' }] : []) });
  try {
    if (mode === 0) {
      await say(g, [`${rules.label}（${rules.edLabel}）。主催は${rules.organizer}。`, `出場資格は${rules.eligibilityText}。`, `エントリー料は${rules.fee.text}。優勝賞金は1000万円。決勝は12月、${rules.broadcast}。`, `予選は${rules.rounds.map((r) => `${r.name}（${r.length / 60}分）`).join('→')}。${rules.revival ? '準決勝で敗れても、決勝当日の敗者復活戦がある。' : ''}`, y === 2001 ? '今年が第1回。全国の若手漫才師が「漫才日本一」を目指す。' : `昨年のエントリーは${m1Rules(y - 1) ? m1Rules(y - 1).entriesText : '—'}。今年はもっと増えそうだ。`], STAFF);
    }
    if (!u.ok) { await say(g, u.why); return null; }
    if (u.last) await say(g, `（結成${u.years}年目…今年が「ラストイヤー」だ。M-1に出られるのは、今年が最後）`);
    const seeded = rules.seeds && (m.me.semis || 0) > 0;
    const firstOpts = (seeded ? P.rounds[1] : P.rounds[0]).opts.map((o, i) => ({ ...o, i })).filter((o) => o.day > t);
    if (!firstOpts.length) { await say(g, '（もう出られる1回戦の日程が残っていない…）'); return null; }
    // the form
    const netaList = has(g, 'netaList') ? safe(() => g.netaList('manzai'), []) || [] : [];
    const st = g.state;
    const rep = st.profile && st.profile.familyName ? `${st.profile.familyName} ${st.name}` : st.name;
    const heisei = rules.era === 'heisei';
    const contact = heisei ? '090-XXXX-XXXX（携帯）' : `${String(st.name).length ? 'dot' : 'user'}${(m.seed % 9000) + 1000}@example.jp`;
    const pickVenue = async () => {
      const i = await g.list({ title: `${seeded ? '2回戦' : '1回戦'}の会場・日程`, items: firstOpts.map((o) => ({ label: `${o.city}　${o.hall}`, right: dateLabel(g, o.day) })), x: 8, y: 8, w: 250 });
      return i >= 0 ? i : undefined;
    };
    const form = {
      year: y, era: heisei ? 'heisei' : 'reiwa', title: `${rules.label} エントリー${heisei ? '用紙' : 'フォーム'}`, submit: '確認して送信する',
      fields: [
        { key: 'name', label: 'コンビ名', value: u.name, req: true, edit: async (gg, f) => askText(gg, { title: 'コンビ名（エントリー名）', value: f.value, max: 12 }) },
        { key: 'kana', label: 'ふりがな', value: u.kana || (/^[ぁ-んァ-ヶー・\s]+$/.test(u.name) ? u.name : ''), req: false, edit: async (gg, f) => askText(gg, { title: 'コンビ名のふりがな', value: f.value, max: 16, placeholder: 'ひらがなで' }) },
        { key: 'rep', label: '代表者氏名', value: rep, req: true, edit: async (gg, f) => askText(gg, { title: '代表者の氏名', value: f.value, max: 12 }) },
        { key: 'members', label: 'メンバー', value: u.members.map((x) => `${x.short || x.name}（${x.role === 'boke' ? 'ボケ' : x.role === 'tsukkomi' ? 'ツッコミ' : '—'}）`).join('・'), ro: true, roWhy: 'メンバーはコンビの登録どおり' },
        { key: 'formed', label: '結成年月', value: `${u.formedYear}年${u.formedMonth ? u.formedMonth + '月' : ''}（結成${u.years}年目）`, ro: true, roWhy: '結成年月の虚偽申告は失格になる' },
        { key: 'agency', label: '所属事務所', value: u.agencyName, ro: true, roWhy: '所属は登録どおり（プロ・アマ問わず出場できる）' },
        { key: 'contact', label: heisei ? '連絡先（電話）' : '連絡先（メール）', value: contact, req: true, edit: async (gg, f) => askText(gg, { title: '連絡先', value: f.value, max: 24 }) },
        { key: 'title', label: 'ネタのタイトル', value: netaList[0] ? netaList[0].title : '', req: false, edit: async (gg, f) => askText(gg, { title: 'ネタのタイトル（未定でもOK）', value: f.value, max: 14 }) },
        { key: 'venue', label: seeded ? '2回戦の希望' : '1回戦の希望', value: `${firstOpts[0].city}・${firstOpts[0].hall}（${dateLabel(g, firstOpts[0].day)}）`, sel: 0, req: true, edit: async (gg, f) => { const i = await pickVenue(); if (i == null) return undefined; f.sel = i; return `${firstOpts[i].city}・${firstOpts[i].hall}（${dateLabel(gg, firstOpts[i].day)}）`; } },
        { key: 'agree', label: '規約・映像使用', value: '同意しない', req: true, edit: async () => '同意する' },
      ],
    };
    if (seeded) form.fields.splice(8, 0, { key: 'seed', label: 'シード', value: '1回戦免除（過去大会で準決勝進出）', ro: true });
    if (mode >= 1 || g.auto) form.fields.find((f) => f.key === 'agree').value = '同意する';
    set.caption = heisei ? '応募用紙に記入する' : '公式サイトのエントリーフォーム';
    let done = null;
    for (;;) {
      done = await formScreen(g, form);
      if (!done) { await say(g, '（エントリーはやめておいた）'); return null; }
      if (form.fields.find((f) => f.key === 'agree').value !== '同意する') { await say(g, '（規約と映像使用への同意がないと、エントリーできない）'); continue; }
      break;
    }
    const val = (k) => (form.fields.find((f) => f.key === k) || {}).value;
    const venueF = form.fields.find((f) => f.key === 'venue');
    const opt = firstOpts[venueF.sel || 0];
    const feeNom = rules.fee.per === 'person' ? rules.fee.nominal * u.members.length : rules.fee.nominal;
    const fee = internal(feeNom);
    if (!heisei) {
      const i = await ask(g, `エントリー料 ${yenNom(feeNom)}（${rules.fee.text}）を支払う。`, ['支払う', 'やめておく'], STAFF, { cancel: 1 });
      if (i !== 0) { await say(g, '（エントリーはやめておいた）'); return null; }
      if (!g.spend(fee)) { await say(g, `お金が足りない…（エントリー料 ${yenNom(feeNom)}）`); return null; }
      sfx(g, 'coin');
    }
    // the entry number: by the order of entry in that year's total
    const Sx = season(g, y);
    const frac = Math.max(0, Math.min(1, (t - P.entryFrom) / Math.max(1, P.entryTo - P.entryFrom)));
    let no = Math.max(1, Math.min(Sx.E, Math.round(Sx.E * (0.03 + 0.9 * Math.pow(frac, 1.4)) + h01(m.seed, y, 'myno') * Sx.E * 0.04)));
    const taken = new Set(Object.values(Sx.nos));
    while (taken.has(no)) no = (no % Sx.E) + 1;
    Sx.playerNo = no;
    const E = {
      y, no, name: val('name') || u.name, unitName: val('name') || u.name, kana: val('kana'), rep: val('rep'), members: u.members.map((x) => x.name), formed: u.formedYear, years: u.years, last: !!u.last,
      agency: u.agencyName, amateur: u.amateur, contact: val('contact'), title: val('title') || '', fee, feeNominal: feeNom, paid: !heisei, day: t,
      status: 'entered', round: seeded ? 1 : 0, seeded, next: { ri: seeded ? 1 : 0, opt: opt.i, day: opt.day, city: opt.city, hall: opt.hall },
      results: [], log: [], neta: [], partner: u.partner, partnerName: u.partnerName,
      cast: u.members.slice(0, 3).map((x) => ({ id: x.id, name: x.short || x.name, role: x.role, look: x.look })),
    };
    m.me.entries[y] = E;
    m.me.name = E.name;
    logLine(E, `${dateLabel(g, t)}　エントリー。エントリーナンバー${no}。${u.last ? '結成' + u.years + '年目、ラストイヤー。' : `結成${u.years}年目。`}`);
    await bigText(g, `エントリーナンバー ${no}`, `「${E.name}」　${rules.label}　${seeded ? '2回戦' : '1回戦'}：${dateLabel(g, opt.day)} ${opt.city}・${opt.hall}`, { min: 30, max: 160 });
    if (heisei) {
      await say(g, ['（応募用紙をポストに投函した）', 'エントリー料は1回戦当日、受付で支払う。受付完了のハガキが届くのを待とう。'].concat(u.partner ? [] : []));
      m.pendingMail = { y, day: t + 1, kind: 'hagaki' };
    } else {
      await card(g, (cx) => mailCard(cx, E, rules, opt, g), { min: 30, max: 200, tag: 'mail' });
      msg(g, 'M-1グランプリ事務局', `【エントリー受付完了】${E.name} 様\nエントリーナンバー：${no}\n${seeded ? '2回戦' : '1回戦'}：${dateLabelY(g, opt.day)} ${opt.city}（${opt.hall}）\n当日はこのメールと身分証をお持ちください。`, { kind: 'chat', contest: 'm1' });
    }
    if (u.partnerName) await say(g, u.last ? 'ラストイヤーや。…絶対、獲りにいこな。' : pickH(['エントリーしたな。もう後戻りでけへんで！', '番号もろたな。1回戦、まずは2分でぶちかまそ！', '今年こそ、ぜったい決勝行こな。'], m.seed, y), partnerWho(u));
    return E;
  } finally {
    popSet(g, set);
  }
}
function statusText(E) { return { entered: '予選に参加中', out: '敗退', finalist: '決勝進出', revival: '敗者復活戦へ', champion: '優勝！', withdrawn: '棄権' }[E.status] || E.status; }
function mailCard(c, E, rules, opt, g) {
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(0, 0, 640, 360, 'rgba(0,0,0,0.6)');
  R(150, 40, 340, 270, '#f4f6fa'); R(150, 40, 340, 26, '#2a3a6a');
  const T = (s, x, y, size, col) => { c.font = `${size}px "DotGothic16", monospace`; c.fillStyle = col; c.textBaseline = 'top'; c.fillText(String(s).slice(0, 34), x, y); };
  T('受信メール', 160, 46, 12, '#fff');
  T('From: M-1グランプリ事務局', 162, 76, 10, '#4a5468');
  T('件名：エントリー受付完了のお知らせ', 162, 92, 11, '#14141c');
  T(`${E.name} 様`, 162, 116, 12, '#14141c');
  T(`エントリーナンバー：${E.no}`, 162, 140, 14, '#c8102e');
  T(`${E.seeded ? '2回戦' : '1回戦'}：${opt.city}（${opt.hall}）`, 162, 166, 11, '#14141c');
  T(dateLabelY(g, opt.day), 162, 184, 11, '#14141c');
  T(`エントリー料 ${E.feeNominal.toLocaleString('ja-JP')}円 お支払い済み`, 162, 206, 10, '#4a5468');
  T('当日はこのメールと身分証をお持ちください。', 162, 230, 10, '#4a5468');
  T(rules.label, 162, 284, 10, '#8a94a8');
}

// The pair that entered is no longer together (解散 / a new partner): the entry is withdrawn (棄権).
async function brokeUp(g, E, u) {
  if (!E || !Array.isArray(E.cast) || E.cast.length < 2) return false;
  const was = E.cast.find((x) => x.id !== 'player');
  if (u.members.length >= 2 && (!was || u.members.some((x) => x.id === was.id))) return false;
  E.status = 'withdrawn'; E.next = null;
  logLine(E, 'コンビが解散し、M-1を棄権。');
  await say(g, [`（「${E.name}」は、もうコンビとして活動していない…）`, 'M-1グランプリは、エントリーしたコンビで出る大会。今年は棄権するしかない。'], STAFF);
  return true;
}

// ================================================================ a 予選 round
export async function roundFlow(g, ri) {
  const m = M(g);
  const y = cal(g).year;
  const E = entryOf(g, y);
  const P = plan(g, y);
  if (!E || !P || E.status !== 'entered' || !E.next || E.next.ri !== ri) return null;
  const rules = P.rules;
  const R = rules.rounds[ri];
  const u = unitInfo(g, y);
  if (await brokeUp(g, E, u)) return null;
  const pw = partnerWho(u);
  const isSF = R.id === 'sf';
  const mode = await chooseMode(g, isSF ? 'sf' : 'round', `今日は${rules.label}の${R.name}だ。`);
  const set = pushSet(g, 'uketsuke', { year: y, sub: `${R.name}　${E.next.city}・${E.next.hall}`, cast: [] });
  const me = { look: g.state.look, x: 270, y: 236, s: 2, dir: 'up' };
  const pa = u.partnerLook ? { look: u.partnerLook, x: 330, y: 236, s: 2, dir: 'up' } : null;
  let bonus = 0;
  let res = null;
  try {
    // ---- travel
    const city = E.next.city;
    if (city !== homeCity(g) && FARE[city]) {
      const fare = FARE[city];
      if (g.state.money >= fare) { g.addMoney(-fare, true); if (mode === 0) await say(g, `（${city}まで移動した。交通費 往復¥${fare.toLocaleString('ja-JP')}）`); }
      else { await say(g, `（交通費が足りない…夜行バスを乗りついで${city}へ。体力 -10）`); g.state.stamina = Math.max(0, g.state.stamina - 10); bonus -= 2; }
    }
    // ---- 受付
    set.cast = [{ look: MC.staff.look, x: 320, y: 168, s: 2 }, me].concat(pa ? [pa] : []);
    set.caption = `${rules.label}　${R.name}（${R.length / 60}分）　${dateLabel(g, today(g))}`;
    if (mode === 0) await say(g, [`エントリーナンバー${E.no}番、「${E.name}」さんですね。`, 'こちらが番号札です。胸の見えるところにつけてください。'], STAFF);
    if (!E.paid) {
      if (!g.spend(E.fee)) { await say(g, `エントリー料（${yenNom(E.feeNominal)}）が払えない…。\n（棄権扱いになってしまった）`, STAFF); E.status = 'withdrawn'; E.next = null; logLine(E, `${R.name}：エントリー料が払えず棄権。`); return null; }
      E.paid = true; sfx(g, 'coin');
      if (mode === 0) await say(g, `（受付でエントリー料 ${yenNom(E.feeNominal)} を支払った）`);
    }
    if (!g.hasItem('m1_badge')) g.giveItem('m1_badge', 1, true);
    // ---- 楽屋
    set.kind = 'gakuya';
    const field = fieldOf(m, y, ri);
    const near = field.slice().sort((a, b) => Math.abs(a.no - E.no) - Math.abs(b.no - E.no)).slice(0, 4).sort((a, b) => a.no - b.no);
    const others = near.map((e) => (e.c && !e.c.anon ? comboAct(m, y, e.c, e.no) : comboAct(m, y, anonCombo(sd(m, y), y, e.no), e.no)));
    set.order = others.slice(0, 2).map((a) => a.name).concat([E.name]).concat(others.slice(2).map((a) => a.name));
    set.me = E.name;
    set.cast = [];
    others.slice(0, 3).forEach((a, i) => {
      const x = [56, 172, 410][i], yy = 196 - (i % 2) * 6;
      a.members.slice(0, 2).forEach((mb, k) => set.cast.push({ look: mb.look, x: x + k * 34, y: yy, s: 1.5, tag: k === 0 ? a.name : null, sub: k === 0 ? '★'.repeat(stars(a.power)) + '☆'.repeat(5 - stars(a.power)) : null }));
    });
    set.cast.push({ ...me, x: 300, y: 232, dir: 'down', s: 2 }); if (pa) set.cast.push({ ...pa, x: 352, y: 232, dir: 'down', s: 2 });
    set.info = [`同じ組の出場者（${R.name}）`].concat(others.map((a) => `No.${a.no} ${a.name}　${'★'.repeat(stars(a.power))}${a.tags.length ? '　' + a.tags.slice(0, 2).join('・') : ''}`));
    if (ri >= 2) set.info.push('（勝ち上がるほど、相手は強くなる）');
    if (mode === 0) {
      const i = await ask(g, '楽屋。ほかの出場者がネタ合わせをしている…。', ['話しかける', 'ネタに集中する'], null, { cancel: 1 });
      if (i === 0 && others.length) {
        const a = others.slice().sort((p, q) => q.tags.length - p.tags.length)[0];
        const who = { name: `${a.name}の${a.members[0].name}`, look: a.members[0].look };
        const line = a.tags.includes('ラストイヤー') ? '今年がラストイヤーなんです。…悔いだけは残したくなくて。' : a.tags.includes('アマチュア') ? '普段は会社員です。有給とって来ました（笑）' : a.tags.includes('準決勝常連') ? '毎年ここまでは来れるんです。問題はその先なんですよね。' : a.tags.includes('結成1年目') ? '結成したばっかりです！記念受験…のつもりはないですけど！' : a.tags.includes('前年ファイナリスト') ? '去年の決勝の景色、もう一回見たいんで。' : pickH(['お互い頑張りましょう！', '2分って、ほんま一瞬ですよね。', '今日のお客さん、重いらしいですよ…。'], a.name);
        await say(g, line, who);
        logLine(E, `${R.name}の楽屋で「${a.name}」と話した。`);
      }
    }
    set.info = null;
    // ---- 出囃子確認（音響）
    if (mode === 0) {
      const i = await ask(g, `音響さん「${R.name}の出囃子は全組共通です。出のタイミングだけ確認させてください」`, ['勢いよく走って出る', 'ゆっくり歩いて出る', '客席に手を振りながら出る'], { name: '音響スタッフ', look: MC.ad.look }, { cancel: 0 });
      bonus += [1, 0, 1][Math.max(0, i)] || 0;
      if (i === 2 && ri <= 1) bonus += 1; // 予選の重い客席には愛嬌が効く
    } else bonus += 1;
    // ---- リハーサル / 場当たり (準々決勝から)
    if (ri >= 3 || isSF) {
      set.kind = 'stage'; set.cast = [{ ...me, x: 282, y: 222, dir: 'down' }].concat(pa ? [{ ...pa, x: 358, y: 222, dir: 'down' }] : []);
      set.caption = '場当たり（立ち位置・センターマイク・明かりの確認）';
      const tallP = h01('tall', u.partner || 'p') < 0.5;
      if (mode === 0) {
        if (pw) await say(g, tallP ? 'マイク、ちょっと上げてもらおか。俺に合わせたら、おまえの声拾われへんけど…いや、真ん中でええか。' : '俺、背ぇ低いから、マイクは低めがええかもな。', pw);
        const i = await ask(g, 'センターマイクの高さは？', ['高め', 'ふたりの真ん中', '低め'], { name: '舞台監督', look: MC.ad.look }, { cancel: 1 });
        const right = tallP ? 1 : 2;
        bonus += i === right ? 2 : i === 1 ? 1 : -1;
        await say(g, i === right ? '（ばっちりだ。ふたりの声がきれいに乗る）' : i === 1 ? '（まあまあだ）' : '（…少しずれている気がする）');
      } else bonus += 1;
    }
    // ---- ネタ選び
    set.kind = 'rouka'; set.caption = '舞台裏'; set.cast = [{ ...me, x: 290, y: 222, dir: 'right' }].concat(pa ? [{ ...pa, x: 340, y: 222, dir: 'left' }] : []);
    const neta = await chooseNeta(g, R.length, `${rules.label} ${R.name}（${R.length / 60}分）`, null, mode);
    if (neta) {
      E.neta.push(neta.id);
      if (usedBefore(g, neta, y)) { bonus -= 4; await say(g, '（このネタは前の大会でもかけた…審査員には「去年と同じ」と思われるかもしれない）'); }
      if (neta.length && neta.length > R.length + 15 && mode === 0) {
        const i = await ask(g, `ネタは約${Math.round(neta.length)}秒。持ち時間は${R.length}秒だ。`, ['削って尺に収める', 'このままいく（尺オーバーの危険）'], pw, { cancel: 0 });
        if (i === 0) { bonus -= 1; neta._cut = true; }
      }
    }
    // ---- 舞台裏稽古 + ネタ合わせ
    if (mode === 0) {
      const i = await ask(g, '本番まで、あと少し。廊下で…', ['通し稽古をする', 'ツカミだけ確認する', '深呼吸して休む'], null, { cancel: 2 });
      if (i === 0) { practice(g, neta, 4); g.state.stamina = Math.max(0, g.state.stamina - 5); bonus += 1; }
      else if (i === 1) { practice(g, neta, 2); }
      else { safe(() => g.addNeed('stress', -6)); }
    } else practice(g, neta, 3);
    await netaAwase(g, E, u, neta, mode, R.name);
    // ---- 舞台袖
    set.kind = 'sode'; set.caption = '舞台袖'; set.timer = `持ち時間 ${Math.floor(R.length / 60)}:${String(R.length % 60).padStart(2, '0')}`;
    set.cast = [{ ...me, x: 470, y: 228, dir: 'right' }].concat(pa ? [{ ...pa, x: 420, y: 228, dir: 'right' }] : []).concat([{ look: MC.ad.look, x: 300, y: 228, s: 2, dir: 'down' }]);
    const cut = cutOf(m, y, ri);
    const pct = odds(g, neta, cut - bonus);
    set.info = [`${R.name}の通過ライン（目安）：${cut}点前後`, `実力${powerOf(g)}・ネタ${qualityOf(g, neta)}${bonus ? `・準備${bonus > 0 ? '+' : ''}${bonus}` : ''}`, `通過の見込み：約${pct}%`];
    await say(g, `次、エントリーナンバー${E.no}番、${E.name}さん。スタンバイお願いします。`, { name: '舞台監督', look: MC.ad.look });
    set.info = null;
    // ---- 本番
    set.kind = 'stage'; set.caption = `${R.name}　No.${E.no} ${E.name}`; set.react = 0;
    set.cast = [{ ...me, x: 282, y: 222, dir: 'down' }].concat(pa ? [{ ...pa, x: 358, y: 222, dir: 'down' }] : []);
    sfx(g, 'drum');
    const tired = !tick(g, STAMINA[Math.min(4, ri)], 8 + ri * 2);
    res = await doPerform(g, { neta, length: R.length, title: `${rules.label} ${R.name}`, round: R.id, contestName: rules.label, venueName: `${E.next.city}・${E.next.hall}`, size: ROUND_LOOK.size[Math.min(4, ri)], crowd: ROUND_LOOK.crowd[Math.min(4, ri)], pressure: ROUND_LOOK.pressure[Math.min(4, ri)], skip: mode === 2 });
    markUsed(g, neta, y);
    let s = res.score + bonus - (tired ? 5 : 0);
    if (res.overtime > 0 && !(neta && neta._cut)) s -= Math.min(12, Math.ceil(res.overtime / 3));
    s = Math.max(0, Math.min(100, s));
    const passed = s >= cut;
    set.react = s >= cut - 4 ? 1 : 0;
    if (s >= cut) { sfx(g, 'laugh'); await sleepy(g, 500); sfx(g, 'applause'); } else sfx(g, 'applause');
    await say(g, s >= cut + 8 ? '（ドカン！と大きな笑いが来た！）' : s >= cut ? '（笑いは来た。手ごたえはある…）' : s >= cut - 8 ? '（笑いはあった…でも、足りたかどうか）' : '（客席が重い…最後まで乗ってこなかった）');
    const rk = (() => { const sc = scoresOf(m, y, ri); let above = 0; for (const v of sc) if (v > s) above++; return above + 1; })();
    const rec = { ri, round: R.name, score: s, raw: res.score, rank: res.rank, passed, cut, place: rk, of: field.length + 1, city: E.next.city, hall: E.next.hall, day: today(g), flubs: res.flubs, overtime: res.overtime, neta: neta ? neta.title : '' };
    E.results.push(rec);
    // ---- 結果発表
    if (mode === 0) await say(g, rules.era === 'heisei' ? '（その日の夜、会場の前に合格者の一覧が貼り出された）' : '（その夜、公式サイトに結果が発表された）');
    await showBoard(g, y, ri, E, passed);
    if (passed) {
      await bigText(g, `${R.name} 合格！`, `${E.name}　${R.pass}組${ri === 0 ? `（エントリー${m1Rules(y).entriesText}）` : ''}が次へ`, { min: 30, max: 160 });
      if (!isSF) rewards(g, R.id);
      safe(() => has(g, 'addComedyStat') && g.addComedyStat('dokyo', 1, true));
      logLine(E, `${R.name}（${E.next.city}）：${s}点で合格。${pickH(['「まだまだいける」', '「次や、次」', '「ここからが本番」'], y, ri)}`);
      if (isSF) {
        E.next = null;
        await finalistsPress(g, E, true, u);
      } else {
        await nextRound(g, E, ri + 1, P, u, mode);
      }
    } else {
      await bigText(g, `${R.name} 敗退…`, `${E.name}　通過ライン${cut}点前後／${s}点`, { min: 30, max: 160, color: '#ff8a8a' });
      const why = reasonLines(g, { ...res, score: s }, Math.max(40, cut));
      await say(g, ['（後日、予選審査員のメモが届いた）'].concat(why.map((l) => `・${l}`)), { name: MC.writer.name, look: MC.writer.look });
      logLine(E, `${R.name}（${E.next.city}）：${s}点で敗退。「${why[0]}」`);
      // ワイルドカード (準々決勝 losers, 2015〜)
      if (R.wildcard) {
        const fame = Math.min(30, (g.state.fame || 0) / 100);
        const mine = powerOf(g) * 0.5 + fame + h01(m.seed, y, 'mywc') * 30;
        const best = Math.max(...fieldOf(m, y, ri).slice(0, 60).map((e) => e.p + h01(sd(m, y), y, e.no, 'wc') * 25));
        if (mine > best) {
          await say(g, `（数日後…ワイルドカードの${rules.wildcardMedia}投票で、「${E.name}」が1位に！準決勝へ復活だ！）`);
          news(g, 'wildcard', { x: E.name }, { prio: 2 });
          E.results[E.results.length - 1].wildcard = true;
          logLine(E, '準々決勝で敗れたが、ワイルドカードで準決勝へ。');
          await nextRound(g, E, ri + 1, P, u, mode);
          return rec;
        }
      }
      if (isSF && rules.revival) {
        E.next = null;
        await finalistsPress(g, E, false, u);
      } else {
        E.status = 'out'; E.next = null;
        await afterLoss(g, E, u, R, y);
      }
    }
    return rec;
  } finally {
    popSet(g, set);
    safe(() => g.save());
  }
}
async function netaAwase(g, E, u, neta, mode, roundName) {
  const pw = partnerWho(u);
  if (!pw) return;
  const harmony = u.harmony ?? 50;
  const stress = (g.state.life && g.state.life.stress) || 0;
  const p = Math.max(0.05, Math.min(0.6, (60 - harmony) / 100 + stress / 300 + 0.1));
  if (h01(g.state.day, E.no, roundName, 'awase') > p) {
    if (mode === 0) await say(g, pickH(['よっしゃ、今日もいつも通りな。', '（相方と目を合わせて、うなずいた）', 'ツカミ、いつもより一拍ためよか。'], E.no, roundName), pw);
    if (u.partner) safe(() => g.addAff(u.partner, 1, true));
    return;
  }
  if (mode >= 1) { practice(g, neta, 1); return; }
  await say(g, pickH(['…なあ、二個目のボケ、変えへん？今日の客、あれ伝わらん気がする。', 'ちょっと待って。後半のくだり、テンポ上げたほうがええって。', '正直に言うけど、今日のネタ、こっちのほうがええと思うねん。'], E.no, roundName), pw);
  const i = await ask(g, '本番直前、相方と意見が割れた。', ['相方の案でいく', '元のままでいく', 'ふたりで折衷案を考える'], null, { cancel: 1 });
  if (i === 0) { if (u.partner) safe(() => g.addAff(u.partner, 3, true)); practice(g, neta, h01(E.no, 'alt') < 0.5 ? 2 : -2); logLine(E, `${roundName}の直前、相方の案でボケを変えた。`); await say(g, 'おおきに。…信じてくれてありがとな。', pw); }
  else if (i === 1) { if (u.partner) safe(() => g.addAff(u.partner, -2, true)); logLine(E, `${roundName}の直前、ネタを変えるかで揉めた。`); await say(g, '…わかった。ほな、元のままで。', pw); }
  else { g.state.stamina = Math.max(0, g.state.stamina - 5); practice(g, neta, 3); if (u.partner) safe(() => g.addAff(u.partner, 1, true)); logLine(E, `${roundName}の直前、廊下でふたりで新しい形を作った。`); await say(g, 'これや。これでいこ。', pw); }
}
async function showBoard(g, y, ri, E, passed) {
  const m = M(g);
  const rules = m1Rules(y);
  const R = rules.rounds[ri];
  const list = passedOf(m, y, ri).map((e) => ({ no: e.no, name: e.c && !e.c.anon ? e.c.n : anonCombo(sd(m, y), y, e.no).n }));
  if (passed) list.push({ no: E.no, name: E.name, me: true });
  list.sort((a, b) => a.no - b.no);
  let rows = list;
  let mine = list.findIndex((r) => r.me);
  if (list.length > 60) {
    // the part of the list around the player's number
    const at = mine >= 0 ? mine : list.findIndex((r) => r.no > E.no);
    const a = Math.max(0, (at < 0 ? list.length : at) - 24);
    rows = list.slice(a, a + 48);
    mine = rows.findIndex((r) => r.me);
  }
  rows = rows.map((r) => ({ ...r, mark: '合格', markColor: r.me ? '#c8102e' : '#3a6fd8' }));
  await boardScreen(g, {
    year: y, era: rules.era === 'heisei' ? 'heisei' : 'reiwa', title: `${rules.label} ${R.name} 結果`, sub: `${E.next ? E.next.city + '会場ほか　' : ''}合格者 ${list.length}組（エントリーナンバー順・敬称略）`,
    rows, mine: mine >= 0 ? mine : 0, total: list.length, note: passed ? '' : `「${E.name}」（No.${E.no}）の名前は、なかった…`,
  });
}
async function nextRound(g, E, ni, P, u, mode) {
  const R = P.rounds[ni];
  const t = today(g);
  const opts = R.opts.map((o, i) => ({ ...o, i })).filter((o) => o.day > t);
  if (!opts.length) { E.status = 'out'; E.next = null; await say(g, '（次の日程に間に合わない…）'); return; }
  let k = 0;
  if (opts.length > 1 && mode === 0 && !g.auto) {
    k = await ask(g, `${R.name}の日程を選ぶ（${R.length / 60}分ネタ）`, opts.map((o) => `${dateLabel(g, o.day)} ${o.city}（${o.hall}）`), STAFF, { cancel: 0 });
    k = Math.max(0, k);
  }
  const o = opts[k];
  E.next = { ri: ni, opt: o.i, day: o.day, city: o.city, hall: o.hall };
  E.round = ni;
  await say(g, `次は${R.name}。${dateLabel(g, o.day)}、${o.city}（${o.hall}）。${R.length / 60}分のネタだ。`);
}
async function afterLoss(g, E, u, R, y) {
  const pw = partnerWho(u);
  if (E.last) {
    await say(g, ['（結成' + E.years + '年目、ラストイヤー。M-1は、ここで終わった）'], null);
    if (pw) await say(g, '…終わったな。ありがとう。おまえとM-1出れて、ほんまによかった。', pw);
    news(g, 'lastYearTears', { x: E.name }, { prio: 1 });
  } else if (pw) {
    await say(g, pickH(['…くそっ。来年や。来年また、ここに来よ。', 'ネタ、一から作り直そ。俺も、もっと練習する。', 'まだ終わりちゃう。漫才はこれからも続くんやから。'], y, R.id), pw);
  }
  if (R.id === 'r1' && (E.results.length <= 1)) await say(g, '（1回戦で敗退するのは、エントリーの8割以上。ネタを書き、稽古を重ね、劇場で場数を踏もう）');
  safe(() => g.addNeed('stress', 6));
}
// ---- 決勝進出者発表 (press conference after the 準決勝)
async function finalistsPress(g, E, inFinal, u) {
  const m = M(g);
  const y = E.y;
  const rules = m1Rules(y);
  const fin = prepareFinal(m, y);
  // the player takes a place among the finalists (the last of the others drops to the 敗者復活戦)
  if (inFinal && !fin.finalists.includes('me')) {
    const dropped = fin.finalists.pop();
    fin.finalists.push('me');
    fin.losers.unshift(dropped);
    if (rules.revival && rules.revival.kind === 'blocks') fin.losers = fin.losers.slice(0, rules.revival.field);
  } else if (!inFinal && rules.revival) {
    const myS = E.results[E.results.length - 1].score;
    const all = fin.losers.map((k) => [fin.semiScores[k] ?? 0, k]).concat([[myS, 'me']]).sort((a, b) => b[0] - a[0]);
    const cap = rules.revival.kind === 'blocks' ? rules.revival.field : all.length;
    fin.losers = all.slice(0, cap).map((x) => x[1]);
    E.inRevival = fin.losers.includes('me');
  }
  fin.semiScores.me = E.results[E.results.length - 1].score;
  m.me.semis = (m.me.semis || 0) + 1;
  const set = pushSet(g, 'press', { year: y, cast: [] });
  const keys = fin.finalists.slice().sort((a, b) => (a === 'me' ? E.no : actOf(m, y, a).no || 0) - (b === 'me' ? E.no : actOf(m, y, b).no || 0));
  try {
    await say(g, [`${rules.label}、決勝進出者を発表します。`, '名前を呼ばれた組は、前へお進みください。'], MC.sub);
    const names = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const a = k === 'me' ? meAct(g, y, E) : actOf(m, y, k);
      names.push(a.name);
      const x = 70 + i * (500 / Math.max(1, keys.length - 1));
      a.members.slice(0, 2).forEach((mb, j) => set.cast.push({ look: mb.look, x: x - 8 + j * 16, y: 196, s: 1.5, tag: j === 0 ? a.name : null, tagBg: k === 'me' ? 'rgba(200,16,46,0.9)' : undefined }));
      set.flash(); sfx(g, k === 'me' ? 'fanfare' : 'shutter');
      if (!g.auto) await g.wait(k === 'me' ? 700 : 260);
      if (k === 'me') { await bigText(g, '決勝進出！', `「${E.name}」${(m.me.finals || 0) ? `${m.me.finals + 1}度目の決勝` : '初の決勝進出'}`, { confetti: true, min: 40, max: 220 }); }
    }
    const firsts = keys.filter((k) => (k === 'me' ? !m.me.finals : !actOf(m, y, k).finals)).length;
    const lastOnes = keys.filter((k) => (k === 'me' ? E.last : actOf(m, y, k).last)).map((k) => (k === 'me' ? E.name : actOf(m, y, k).name));
    news(g, `${rules.label} 決勝進出者発表：${names.join('、')}。初の決勝進出は${firsts}組。`, {}, { prio: 3, once: `finalists_${y}`, key: `finalists|m1|${y}` });
    if (lastOnes.length) news(g, `「${lastOnes[0]}」、ラストイヤーで悲願の決勝進出。`, {}, { prio: 2, once: `finlast_${y}` });
    const amas = keys.filter((k) => (k === 'me' ? E.amateur : actOf(m, y, k).amateur));
    if (amas.length) news(g, 'amateurFinal', { x: amas[0] === 'me' ? E.name : actOf(m, y, amas[0]).name }, { prio: 2, once: `finama_${y}` });
    if (inFinal) {
      E.status = 'finalist';
      rewards(g, 'sf'); rewards(g, 'final');
      const i = await ask(g, '記者「決勝への意気込みを！」', ['「優勝しかないです！」', '「ふたりで一番面白い4分を」', '「…ボケていいですか？」'], { name: '記者', look: MC.ad.look }, { cancel: 1 });
      const q = ['優勝しかないです！', 'ふたりで一番面白い4分を見せます。', '（ボケた。会見場がちょっと笑った）'][Math.max(0, i)];
      logLine(E, `決勝進出者会見で「${q}」`);
      if (i === 2) g.addFame(20, true);
      const pw = partnerWho(u);
      if (pw) await say(g, E.last ? 'ラストイヤーで…決勝や。泣くのはまだ早いで。' : 'ほんまに…決勝や。夢ちゃうよな？', pw);
    } else {
      rewards(g, 'sf');
      E.status = rules.revival ? (E.inRevival !== false ? 'revival' : 'out') : 'out';
      if (E.status === 'revival') {
        const P = plan(g, y);
        await say(g, [`（名前は、呼ばれなかった…）`, `でも、まだ終わりじゃない。決勝当日（${dateLabel(g, P.finalDay)}）の敗者復活戦で勝てば、決勝の最後の1枠に入れる。`, `会場：${rules.revival.venue}／審査：${rules.revival.judge}`]);
        E.next = { ri: rules.rounds.length, day: P.finalDay, city: '東京', hall: rules.revival.venue, revival: true };
        logLine(E, '準決勝で敗れ、敗者復活戦へ。');
      } else {
        await say(g, '（名前は、呼ばれなかった…。準決勝敗退）');
        logLine(E, '準決勝で敗退。');
        await afterLoss(g, E, u, rules.rounds[rules.rounds.length - 1], y);
      }
    }
  } finally { popSet(g, set); }
}

// ================================================================ the final day
export async function finalDayFlow(g) {
  const m = M(g);
  const y = cal(g).year;
  const E = entryOf(g, y);
  const rules = m1Rules(y);
  if (!E || !rules || !['finalist', 'revival'].includes(E.status)) return watchFinal(g);
  const u = unitInfo(g, y);
  if (await brokeUp(g, E, u)) return;
  const fin = prepareFinal(m, y);
  if (E.status === 'revival') {
    const won = await revivalFlow(g, E, u, rules, fin);
    if (!won) { E.status = 'out'; await watchFinal(g, { after: true }); return; }
  }
  await finalFlow(g, E, u, rules, fin);
}
async function revivalFlow(g, E, u, rules, fin) {
  const m = M(g);
  const y = E.y;
  const RV = rules.revival;
  const mode = await chooseMode(g, 'revival', '決勝当日。まずは敗者復活戦だ。');
  const set = pushSet(g, RV.outdoor ? 'outdoor' : 'revival_in', { year: y, venue: RV.venue, sub: RV.venue, cast: [] });
  const pw = partnerWho(u);
  try {
    const me = { look: g.state.look, x: 282, y: 196, s: 2 };
    const pa = u.partnerLook ? { look: u.partnerLook, x: 358, y: 196, s: 2 } : null;
    set.cast = [me].concat(pa ? [pa] : []);
    set.caption = `${rules.label} 敗者復活戦　${RV.venue}`;
    await say(g, [`${rules.label}、敗者復活戦！準決勝で敗れた${fin.losers.length}組が、決勝の最後の1枠を争います！`, `審査は${RV.judge}。`], MC.revival);
    if (RV.outdoor && mode === 0) { await say(g, '（冬の夜風が冷たい。指先がかじかむ…白い息の漫才師たちがネタ合わせをしている）'); if (pw) await say(g, 'さっむ…。でもな、ここから決勝行ったら、いちばんドラマあるで。', pw); }
    if (RV.kind === 'blocks') {
      const blocks = [[], [], []];
      fin.losers.forEach((k, i) => blocks[i % 3].push(k));
      const bi = blocks.findIndex((b) => b.includes('me'));
      set.blocks = blocks.map((b, i) => `${'ABC'[i]}ブロック（${b.length}組）`);
      set.blockIdx = bi;
      if (mode === 0) await say(g, `${'ABC'[bi]}ブロック。ネタを終えるたび、観客の投票で「前の組より面白いか」を決める勝ち残り方式だ。`);
    }
    const neta = await chooseNeta(g, 240, `${rules.label} 敗者復活戦（4分）`, null, mode);
    await netaAwase(g, E, u, neta, mode, '敗者復活戦');
    tick(g, 24, 12);
    const res = await doPerform(g, { neta, length: 240, title: `${rules.label} 敗者復活戦`, round: 'revival', contestName: rules.label, venueName: RV.venue, size: 'hall', crowd: RV.outdoor ? 'cold' : 'normal', pressure: 75, skip: mode === 2 });
    markUsed(g, neta, y);
    const s = Math.max(0, Math.min(100, res.score - (RV.outdoor ? 1 : 0)));
    set.react = 1; sfx(g, 'laugh');
    const rv = runRevival(m, y, s);
    E.results.push({ ri: rules.rounds.length, round: '敗者復活戦', score: s, rank: res.rank, passed: rv.winner === 'me', day: today(g), neta: neta ? neta.title : '' });
    E.revNeta = neta ? neta.id : null;
    if (RV.kind === 'blocks' && rv.blocks) {
      const myB = rv.blocks.find((b) => b.keys.includes('me'));
      const bw = myB ? myB.winner : null;
      await say(g, bw === 'me' ? `${myB.name}を勝ち抜いたのは…「${E.name}」！` : `${myB ? myB.name : ''}を勝ち抜いたのは…「${actOf(m, y, bw || rv.winner).name}」。`, MC.revival);
      if (bw === 'me') {
        const cnt = (fin.revivalVotes && fin.revivalVotes.me) || 0;
        await say(g, `最後は芸人審査員の投票。3ブロックの勝者から、決勝へ行く1組は…${cnt ? `（${E.name}に${cnt}票）` : ''}`, MC.revival);
      }
    } else if (RV.kind === 'vote') {
      await say(g, '敗者復活戦の結果は、視聴者投票。発表は決勝の生放送の中で…');
    } else {
      await say(g, `${RV.judge}による審査の結果…`, MC.revival);
    }
    sfx(g, 'drum'); await sleepy(g, 600);
    if (rv.winner === 'me') {
      await bigText(g, '敗者復活！', `「${E.name}」が決勝最後の1枠へ！`, { confetti: true, min: 40, max: 200 });
      news(g, 'revival', { x: E.name, venue: RV.venue, n: fin.losers.length }, { prio: 3 });
      logLine(E, `敗者復活戦（${RV.venue}）を勝ち抜いた。${s}点。`);
      E.status = 'finalist'; E.revivalWin = true;
      rewards(g, 'final');
      if (pw) await say(g, '行くで…！テレビ朝日まで走れ！', pw);
      return true;
    }
    const wn = actOf(m, y, rv.winner).name;
    await bigText(g, '敗者復活ならず', `決勝へ進んだのは「${wn}」`, { min: 30, max: 160, color: '#ff8a8a' });
    news(g, 'revival', { x: wn, venue: RV.venue, n: fin.losers.length }, { prio: 3 });
    logLine(E, `敗者復活戦で敗れた（決勝へは「${wn}」）。`);
    await afterLoss(g, E, u, { id: 'revival' }, y);
    return false;
  } finally { popSet(g, set); safe(() => g.save()); }
}

// ネットの反応: 匿名掲示板 (2001〜2010) / SNS (2015〜, the era's name for it)
function netPosts(g, y, champ, meChamp, me, top) {
  const heisei = y <= 2010;
  const sns = heisei ? '匿名掲示板' : `${(g.state.profile && g.state.profile.era === 'reiwa') ? 'ドッター' : 'SNS'}の反応`;
  const k = (s) => pickH(s, y, champ);
  const posts = heisei
    ? [`${champ}優勝キター！`, k(['審査員の点数、ちょっと割れすぎじゃね？', '最終決戦、どっちが勝ってもおかしくなかった', '敗者復活の組、普通に強かった']), `${top}の1本目が今年いちばん笑った`, k(['来年も絶対見る', '年末はこれ見ないと終われない', 'テレビの前で正座して見てた'])]
    : [`#M1グランプリ ${champ}おめでとう！！`, k(['審査員コメントまで含めて神回', '笑神籤の引き、ドラマすぎる', '最終決戦の3組、全部優勝でいい']), `${top}の1本目、今年いちばん笑った`, k(['明日から${champ}をテレビで見まくる予感', 'ネタのフレーズがもう頭から離れない', '敗者復活からの流れ、胸アツ']).replace('${champ}', champ)];
  if (me && !meChamp) posts.splice(2, 0, heisei ? `${me}、もっと評価されてもいい` : `${me}、知らなかったけど好きになった`);
  if (meChamp) posts.splice(1, 0, heisei ? `${meChamp}って去年まで誰も知らなかったよな？` : `${meChamp}、ネタ動画ぜんぶ見に行った`);
  return { era: heisei ? 'heisei' : 'reiwa', title: heisei ? `【M-1】${y}年 決勝 実況スレ` : `${sns}　#M1グランプリ`, posts, sns };
}
function judgeComment(j, pts, me) {
  const hi = pts >= 94, lo = pts <= 88;
  const by = { しゃべくり: ['しゃべりの技術が高い。', 'ふたりの会話になってた。'], 正統派: ['基本がしっかりしてる。', '漫才の教科書みたいやった。'], 人間味: ['ふたりの関係が見えて、よかった。', '人柄が出てて好き。'], 構成: ['構成がよくできていた。', '伏線の回収が見事。'], 話芸: ['言葉の選び方がうまい。', '間で笑わせていた。'], コント漫才: ['設定の作り方がうまい。', 'コントに入る瞬間が自然やった。'], テンポ: ['テンポが最後まで落ちなかった。', '後半の加速がすごかった。'], 新しさ: ['見たことない漫才やった。', '発明があった。'], ボケ数: ['手数が多くて、ずっと笑えた。', '後半の畳みかけが効いてた。'], システム: ['システムが発明されてた。', 'ルールがわかってからが強い。'], 変則: ['型の壊し方がうまい。', '攻めてたね。'] }[j.taste] || ['よかったと思います。'];
  if (hi) return `${pickH(by, j.id, pts)}${pts >= 96 ? '今日いちばん笑いました。' : ''}`;
  if (lo) return pickH(['前半がちょっと重かったかな。', 'もうひとつ、大きいボケがほしかった。', 'ツカミで乗り切れなかったね。', '緊張が見えた。もっと自由でいい。'], j.id, pts);
  return pickH(by, j.id, pts) + pickH(['ただ、もう一押しほしかった。', 'あとは後半やね。', ''], j.id, me ? 1 : 0, pts);
}
function rivalNarration(a, s) {
  const style = { しゃべくり: 'テンポのいい掛け合い', 正統派: '王道のしゃべくり漫才', コント漫才: 'コントに入る漫才', システム: '独自のシステムの漫才', 変則: '型破りな漫才', ボケ数: '手数の多い漫才', 話芸: '言葉で聞かせる漫才' }[a.style] || '漫才';
  const r = s >= 90 ? '後半にかけて大爆発！スタジオが揺れた。' : s >= 84 ? 'しっかり笑いを重ねていく。' : s >= 76 ? '笑いは起きるが、大きな波は来ない。' : 'ツカミで滑り、前半が重い…。';
  return `「${a.name}」の${style}。${r}`;
}
async function finalFlow(g, E, u, rules, fin) {
  const m = M(g);
  const y = E.y;
  const pw = partnerWho(u);
  const me = meAct(g, y, E);
  const js = judgesFor(y);
  const nFinal = rules.finalists;
  const revKey = rules.revival ? (E.revivalWin ? 'me' : (fin.revival || runRevival(m, y)).winner) : null;
  const keys = fin.finalists.filter((k) => k !== revKey).concat(revKey ? [revKey] : []).slice(0, nFinal);
  if (!keys.includes('me')) keys[keys.length - 1] = 'me';
  const order = finalOrder(m, y, keys, revKey);
  fin.order = order;
  const actOfK = (k) => (k === 'me' ? me : actOf(m, y, k));
  const mode = await chooseMode(g, 'final', `${rules.label}、決勝の日。`);
  const quickRivals = mode >= 1 || (!g.auto && (await ask(g, 'ほかの組のネタは？', ['紹介VTRから全部見る', '採点だけ見る（早送り）'], null, { cancel: 1 })) === 1);
  const set = pushSet(g, 'studio', { year: y, cast: [], studio: { judges: js.map((j, i) => ({ ...j, look: lookFor(i % 4 === 2 ? 'f' : 'm', 'judge', j.id) })), ranking: [] } });
  const S = set.studio;
  const meStand = (x = 282) => [{ look: g.state.look, x, y: 202, s: 2 }].concat(u.partnerLook ? [{ look: u.partnerLook, x: x + 76, y: 202, s: 2 }] : []);
  const mcCast = { look: MC.main.look, x: 66, y: 202, s: 2, dir: 'right' };
  const rivalStand = (a) => a.members.slice(0, 2).map((mb, i) => ({ look: mb.look, x: 282 + i * 76, y: 202, s: 2 }));
  try {
    // ---- before the show: 楽屋・リハーサル・出囃子確認
    if (mode === 0) {
      set.kind = 'gakuya'; set.order = order.map((k) => actOfK(k).name); set.me = E.name;
      set.cast = meStand(282).map((c) => ({ ...c, y: 232 }));
      await say(g, [`（${rules.finalVenue}。決勝の楽屋には、ファイナリストたちの名前が並んでいる）`, rules.emikuji ? '（出番は笑神籤で、本番中に決まる。いつ呼ばれてもいいように準備しておかないと）' : `（出番順はすでに決まっている。「${E.name}」は${order.indexOf('me') + 1}番目だ）`]);
      set.kind = 'studio'; set.cast = meStand();
      set.caption = 'リハーサル（場当たり）';
      await say(g, ['センターマイクはこの位置、立ち位置はバミリの上で。明かりはここで当たります。', `登場の出囃子は${M1.song}。音きっかけで、せりから出てください。`], { name: 'フロアディレクター', look: MC.ad.look });
      if (pw) await say(g, 'この曲で出ていくの、ずっと夢やったな…。', pw);
      set.caption = null;
    }
    // ---- on air
    set.kind = 'studio'; set.cast = [mcCast, { look: MC.sub.look, x: 112, y: 202, s: 2, dir: 'right' }];
    set.caption = `${rules.broadcast}${rules.onAir ? '　' + rules.onAir + '〜' : ''}`;
    sfx(g, 'fanfare');
    await say(g, [`${rules.label}！${rules.edLabel}、決勝！`, `エントリー総数${rules.entriesText}の頂点に立つのは、果たしてどの組か！`], MC.main);
    await say(g, `今年の審査員は${js.length}名！${js.map((j) => j.name).join('、')}のみなさんです！`, MC.sub);
    if (mode === 0) for (const j of js.slice(0, 3)) await say(g, j.line, { name: `審査員　${j.name}`, look: S.judges.find((x) => x.id === j.id).look });
    set.caption = null;
    if (revKey && rules.emikuji) {
      await say(g, `まずは、敗者復活戦を勝ち上がった1組の発表です！`, MC.main);
      sfx(g, 'drum'); await sleepy(g, 500);
      const rn = actOfK(revKey).name;
      await say(g, `敗者復活は…「${rn}」！`, MC.main);
      if (revKey !== 'me') news(g, 'revival', { x: rn, venue: rules.revival.venue, n: fin.losers.length }, { prio: 3, once: `rev_${y}` });
    }
    // ---- the first round
    const cards = {};
    const ranking = [];
    const remaining = order.slice();
    let lastS = 0;
    for (let n = 0; n < order.length; n++) {
      const k = order[n];
      const a = actOfK(k);
      if (rules.emikuji) {
        set.studio.led = null;
        await kujiCard(g, { year: y, n: n + 1, name: a.name, remaining: remaining.filter((x) => x !== k).map((x) => actOfK(x).name), emikuji: true, drawer: MC.main.name });
        if (n === 0) news(g, `笑神籤でトップバッターに選ばれたのは「${a.name}」。`, {}, { prio: 1, once: `kuji_${y}_first` });
        if (n === order.length - 1) news(g, `笑神籤、最後に呼ばれたのは「${a.name}」だった。`, {}, { once: `kuji_${y}_last` });
      }
      remaining.splice(remaining.indexOf(k), 1);
      S.led = a.name; S.ledSub = rules.emikuji ? `${n + 1}組目` : `${n + 1}番`;
      const copy = copyFor(m, y, a, { revival: k === revKey, player: k === 'me' });
      if (k === 'me' || !quickRivals) {
        const lines = [`結成${a.years}年目　${a.agency}`, ORIGINS[a.origin] ? `${ORIGINS[a.origin]}` : '', k === 'me' ? E.results.map((r) => `${r.round} ${r.score}点`).join(' → ') : (a.semis ? `準決勝進出 ${a.semis}回` : '準決勝初進出'), a.last ? 'ラストイヤー' : '', k === revKey ? '敗者復活から' : ''].filter(Boolean);
        await pvCard(g, { year: y, copy, name: a.name, members: a.members, lines, key: k, me: k === 'me' });
      }
      if (k === 'me') E.copy = copy;
      set.cast = [mcCast].concat(k === 'me' ? meStand() : rivalStand(a));
      if (!g.auto && (k === 'me' || !quickRivals)) { sfx(g, 'drum'); }
      let s;
      if (k === 'me') {
        await say(g, `${n + 1}組目、「${E.name}」！${E.last ? 'ラストイヤー！' : ''}`, MC.main);
        await say(g, `♪ ${M1.song}`, { name: '出囃子' });
        const neta = await chooseNeta(g, 240, `${rules.label} 決勝（4分）`, null, mode === 2 ? 2 : 0);
        E.finalNeta = neta ? neta.id : null;
        tick(g, 26, 14);
        const res = await doPerform(g, { neta, length: 240, title: `${rules.label} 決勝`, round: 'final', contestName: rules.label, venueName: rules.finalVenue, size: 'tv', crowd: 'warm', pressure: 90, skip: mode === 2 });
        markUsed(g, neta, y);
        s = Math.max(0, Math.min(100, res.score - (res.overtime > 0 ? Math.min(10, Math.ceil(res.overtime / 3)) : 0)));
        E.finalRes = { score: s, rank: res.rank, highlights: res.highlights };
        if (s >= 85) { sfx(g, 'laugh'); await sleepy(g, 400); }
        sfx(g, 'applause');
      } else {
        s = finalScore(m, y, k);
        if (!quickRivals) await say(g, rivalNarration(a, s));
        sfx(g, s >= 86 ? 'laugh' : 'applause');
      }
      const sc = scoreCard(m, y, a, s, k);
      cards[k] = sc;
      fin.scores[k] = sc;
      lastS = s;
      if (k === 'me' || !quickRivals) {
        await revealScores(g, set, { name: a.name, points: sc.pts, total: sc.total, aud: sc.aud, max: rules.audience2001 ? 1000 : js.length * 100, great: js.length * 94 });
      } else { S.points = sc.pts; S.reveal = sc.pts.length; S.total = sc.total; S.totalShown = sc.total; S.totalLabel = a.name; if (!g.auto) await g.wait(300); }
      if (k === 'me') {
        const pick = sc.pts.map((p, i) => [p, i]).sort((x, z) => z[0] - x[0]);
        for (const [p, i] of [pick[0], pick[pick.length - 1]]) await say(g, judgeComment(js[i], p, true), { name: `審査員　${js[i].name}（${p}点）`, look: S.judges[i].look });
        logLine(E, `決勝ファーストラウンド：${n + 1}番目、${sc.total}点。審査員${js[pick[0][1]].name}「${judgeComment(js[pick[0][1]], pick[0][0], true)}」`);
      }
      // the 暫定ボックス (top 3 seats)
      ranking.push({ key: k, name: a.name, total: sc.total, look: a.members[0].look, me: k === 'me', max: Math.max(...sc.pts) });
      ranking.sort((p, q) => q.total - p.total || q.max - p.max);
      const before = S.ranking.map((r) => r.key);
      S.ranking = ranking.slice(0, 3);
      const out = before.find((x) => !S.ranking.some((r) => r.key === x));
      if (S.ranking.some((r) => r.key === k)) { if (!quickRivals || k === 'me') await say(g, `「${a.name}」、暫定${S.ranking.findIndex((r) => r.key === k) + 1}位！${out ? `「${actOfK(out).name}」が暫定ボックスから外れます。` : ''}`, MC.main); }
      else if (k === 'me') await say(g, `「${a.name}」は暫定ボックスに届かず…。`, MC.main);
      S.total = null;
    }
    const top = ranking[0];
    news(g, 'topScore', { x: top.name, s: top.total }, { prio: 1, once: `top_${y}` });
    const jm = js.map((j, i) => [j, Math.min(...order.map((k) => cards[k].pts[i]))]).sort((p, q) => p[1] - q[1])[0];
    news(g, 'judgeTalk', { j: jm[0].name, s: jm[1], line: jm[0].line }, { once: `judge_${y}` });
    const myRank = ranking.findIndex((r) => r.key === 'me') + 1;
    E.finalRank1 = myRank;
    m.me.finals = (m.me.finals || 0) + 1;
    // ---- 最終決戦
    let champ, votes = null;
    const top3 = ranking.slice(0, 3).map((r) => r.key);
    fin.ranking = ranking.map((r) => r.key);
    fin.top3 = rules.finalRound ? top3 : null;
    if (rules.finalRound) {
      S.final = true;
      await say(g, ['ファーストラウンド終了！最終決戦に進むのは…', top3.map((k, i) => `${i + 1}位「${actOfK(k).name}」`).join('、') + '！'], MC.main);
      if (top3.includes('me')) { rewards(g, 'top3'); await bigText(g, '最終決戦進出！', `ファーストラウンド${myRank}位`, { min: 30, max: 160 }); }
      const s2 = {};
      for (const k of top3.slice().reverse()) {
        const a = actOfK(k);
        S.led = a.name; S.ledSub = '最終決戦';
        set.cast = [mcCast].concat(k === 'me' ? meStand() : rivalStand(a));
        if (k === 'me') {
          await say(g, `最終決戦、「${E.name}」！`, MC.main);
          const neta2 = await chooseNeta(g, 240, `${rules.label} 最終決戦（2本目）`, E.finalNeta, mode === 2 ? 2 : 0);
          tick(g, 18, 10);
          const res2 = await doPerform(g, { neta: neta2, length: 240, title: `${rules.label} 最終決戦`, round: 'final2', contestName: rules.label, venueName: rules.finalVenue, size: 'tv', crowd: 'warm', pressure: 95, skip: mode === 2 });
          markUsed(g, neta2, y);
          s2[k] = Math.max(0, Math.min(100, res2.score - (neta2 && neta2.id === E.finalNeta ? 8 : 0)));
          fin.me2 = s2[k];
          sfx(g, s2[k] >= 85 ? 'laugh' : 'applause');
          logLine(E, `最終決戦、2本目のネタ「${neta2 ? neta2.title : ''}」。`);
        } else {
          s2[k] = finalScore(m, y, k, 'f2');
          if (!quickRivals) await say(g, rivalNarration(a, s2[k]));
          sfx(g, 'applause');
        }
      }
      votes = finalVotes(m, y, top3.map((k) => ({ key: k, s1: cards[k].s, s2: s2[k], act: actOfK(k) })));
      fin.votes = votes.map((v) => ({ j: v.judge.id, k: v.key }));
      set.caption = '審査員のみなさんは、優勝だと思う組の名前を…';
      await say(g, 'それでは審査員のみなさん、優勝だと思う組に投票してください！', MC.main);
      await votesCard(g, { year: y, acts: top3.map((k) => ({ key: k, name: actOfK(k).name, me: k === 'me' })), votes: votes.map((v) => ({ judge: v.judge.name, key: v.key })) });
      set.caption = null;
      const count = {};
      for (const v of votes) count[v.key] = (count[v.key] || 0) + 1;
      champ = top3.slice().sort((a, b) => (count[b] || 0) - (count[a] || 0) || cards[b].total - cards[a].total)[0];
      fin.voteCount = count;
    } else {
      champ = ranking[0].key;
    }
    fin.champ = champ; fin.done = true;
    const row = recordHistory(m, y, fin, revKey ? { winner: revKey } : null);
    // ---- 優勝発表
    sfx(g, 'drum'); await sleepy(g, 800);
    const cn = actOfK(champ).name;
    await say(g, `${rules.label}、優勝は…`, MC.main);
    sfx(g, 'drum'); await sleepy(g, 700);
    await say(g, `「${cn}」！！`, MC.main);
    if (champ === 'me') {
      E.status = 'champion';
      m.me.champion = y;
      await championCard(g, { year: y, ed: rules.edition, name: E.name, members: me.members, prize: '1000万円' });
      g.addMoney(internal(M1.prizeNominal), true);
      g.giveItem('m1_trophy', 1, true);
      rewards(g, 'champ');
      safe(() => g.setFlag('m1_champion', y));
      await say(g, [`優勝賞金1000万円と、M-1グランプリのトロフィーを手に入れた！`, `「${E.name}」は第${rules.edition}代M-1王者になった！`]);
      await tearsScene(g, E, u, true);
      logLine(E, `優勝。第${rules.edition}代王者。`);
      news(g, `第${rules.edition}代王者は「${E.name}」！${rules.label}を制した。${rules.finalRound ? `最終決戦で審査員${(fin.voteCount && fin.voteCount.me) || 0}票。` : ''}`, {}, { prio: 5, once: `champ_${y}`, key: `champ|m1|${y}` });
      if (E.revivalWin) news(g, 'championRevival', { x: E.name }, { prio: 4, once: `champrev_${y}` });
      else if (E.last) news(g, 'championLast', { x: E.name }, { prio: 4, once: `champlast_${y}` });
      else news(g, `「${E.name}」、結成${E.years}年目でM-1王者に。優勝賞金1000万円。`, {}, { prio: 3, once: `champy_${y}` });
    } else {
      const myPlace = rules.finalRound && top3.includes('me') ? (top3.slice().sort((a, b) => ((fin.voteCount || {})[b] || 0) - ((fin.voteCount || {})[a] || 0)).indexOf('me') + 1) : myRank;
      E.finalPlace = myPlace;
      if (myPlace === 2) { rewards(g, 'ru'); m.me.ru = (m.me.ru || 0) + 1; }
      await bigText(g, myPlace === 2 ? '準優勝' : `${myPlace}位`, `優勝は「${cn}」`, { min: 30, max: 160, color: '#ffe9a8' });
      await tearsScene(g, E, u, false, myPlace);
      logLine(E, `決勝${myPlace}位。優勝は「${cn}」。`);
      news(g, `第${rules.edition}代王者は「${cn}」！${rules.label}を制した。${rules.finalRound ? `最終決戦で審査員${(fin.voteCount && fin.voteCount[champ]) || 0}票。` : ''}`, {}, { prio: 5, once: `champ_${y}`, key: `champ|m1|${y}` });
      if (myPlace === 2) news(g, 'runnerUp', { x: E.name }, { prio: 2 });
    }
    E.final = { rank1: myRank, total: cards.me ? cards.me.total : 0, champ: champ === 'me', champName: cn, place: E.finalPlace || 1 };
    await netCard(g, netPosts(g, y, cn, champ === 'me' ? E.name : null, E.name, top.name));
    m.me.history = m.me.history || [];
    m.me.history.push({ y, best: champ === 'me' ? '優勝' : `決勝${E.finalPlace || myRank}位`, total: cards.me ? cards.me.total : 0 });
    E.after = { day: today(g) };
    void row;
    // ---- the night: 大反省会 and 打ち上げ
    await afterNight(g, E, u, rules);
  } finally { popSet(g, set); safe(() => g.save()); }
}
async function tearsScene(g, E, u, won, place = 1) {
  const pw = partnerWho(u);
  if (!pw) return;
  if (won) {
    const i = await ask(g, '相方が、こっちを見ている。', ['泣きながら抱き合う', 'ガッツポーズで叫ぶ', '相方の肩を叩いて笑う'], null, { cancel: 0 });
    await say(g, [['（ふたりとも、言葉にならなかった。センターマイクの前で、ただ泣いた）'], ['（「よっしゃあああ！」スタジオが拍手に包まれる）'], ['（「やったな」「やったな」…それだけで十分だった）']][Math.max(0, i)]);
    await say(g, E.last ? 'ラストイヤーで…ほんまに獲ったで…！おまえと組んでよかった…！' : 'おまえと…おまえとやから獲れたんや…！', pw);
    if (u.partner) safe(() => g.addAff(u.partner, 10, true));
  } else {
    await say(g, place === 2 ? '…あと一歩やったな。悔しいわ。めっちゃ悔しい。…でも、楽しかったな。' : 'まだや。まだ終わってへん。来年、またこの曲で出てこよ。', pw);
    if (u.partner) safe(() => g.addAff(u.partner, 4, true));
  }
}
async function afterNight(g, E, u, rules) {
  const m = M(g);
  const y = E.y;
  const pw = partnerWho(u);
  // 世界最速大反省会 (talk)
  const i = await ask(g, `放送のあと、配信の「${rules.hansei}」に出演する？`, ['出演する', '休む'], null, { cancel: 1 });
  if (i === 0) {
    const set = pushSet(g, 'talk', { year: y, sub: `M-1グランプリ${y} ${rules.hansei}`, cast: [{ look: MC.main.look, x: 120, y: 200, s: 2, dir: 'right' }, { look: g.state.look, x: 300, y: 200, s: 2 }].concat(u.partnerLook ? [{ look: u.partnerLook, x: 350, y: 200, s: 2 }] : []) });
    try {
      await say(g, E.status === 'champion' ? `優勝の${E.name}さん！いまの気持ちは！？` : `${E.name}さん、今日を振り返って…どうでした？`, { name: '反省会の進行', look: MC.main.look });
      const k = await ask(g, '配信のコメントが流れていく…', ['本音で反省する', '笑いに変える', '相方をいじる'], null, { cancel: 0 });
      await say(g, ['（ネタの裏話を正直に話した。「好感度上がった」のコメントが流れる）', '（「審査員に怒られたい」とボケて、スタジオが沸いた）', `（相方の${u.partnerName || ''}の緊張エピソードを暴露。相方が真っ赤になった）`][Math.max(0, k)]);
      g.addFame(30, true); g.addFans(800, true);
      logLine(E, `${rules.hansei}で${['本音を話した', '笑いに変えた', '相方をいじった'][Math.max(0, k)]}。`);
      E.after.hansei = true;
    } finally { popSet(g, set); }
  }
  // 打ち上げ
  const j = await ask(g, 'M-1の打ち上げ会場へ行く？', ['行く', '帰る'], null, { cancel: 1 });
  if (j === 0) {
    const js = judgesFor(y);
    const fin = M(g).seasons[y].fin;
    const others = (fin.order || []).filter((k) => k !== 'me').slice(0, 3).map((k) => actOf(m, y, k));
    const set = pushSet(g, 'party', { year: y, cast: [{ look: g.state.look, x: 290, y: 222, s: 2 }].concat(u.partnerLook ? [{ look: u.partnerLook, x: 350, y: 222, s: 2 }] : []).concat(others.map((a, i) => ({ look: a.members[0].look, x: [70, 170, 540][i], y: 214, s: 2, tag: a.name }))) });
    try {
      const age = has(g, 'playerAge') ? safe(() => g.playerAge(), 20) : (g.state.profile && g.state.profile.age) || 20;
      await say(g, age >= 20 ? '（乾杯！ファイナリストも審査員も、スタッフも入り混じっての打ち上げだ）' : '（乾杯！…未成年なので、ウーロン茶で。ファイナリストも審査員も入り混じっての打ち上げだ）');
      const jj = js[Math.floor(h01(m.seed, y, 'party') * js.length)];
      await say(g, E.status === 'champion' ? `おめでとう。…でも、ほんまに大変なんは、明日からやで。` : `ええ漫才やったよ。来年も楽しみにしてる。`, { name: `審査員　${jj.name}`, look: lookFor('m', 'judge', jj.id) });
      if (others[0]) await say(g, pickH(['いやあ、悔しい！来年は負けへんで！', 'おつかれさま！あのボケ、ずるいわ〜（笑）', '今日のこと、一生忘れへんと思う。'], y, others[0].name), { name: `${others[0].name}の${others[0].members[0].name}`, look: others[0].members[0].look });
      if (pw) await say(g, 'なあ…明日から、俺らの人生変わるんかな。', pw);
      safe(() => g.relax({ stress: 20 }));
      E.after.uchiage = true;
      logLine(E, '打ち上げで、審査員やファイナリストと語り明かした。');
    } finally { popSet(g, set); }
  }
}

// ================================================================ watching the final (not in it)
export async function watchFinal(g, o = {}) {
  const m = M(g);
  const y = cal(g).year;
  const rules = m1Rules(y);
  if (!rules) { await say(g, statusOf(g, y).label); return; }
  const S = season(g, y);
  if (!S.fin || !S.fin.done) simulateFinal(m, y);
  const fin = S.fin;
  const row = m.hist.find((h) => h.y === y);
  const set = pushSet(g, 'tvroom', { year: y, tvKind: 'studio', studio: { ranking: [] }, cast: [{ look: g.state.look, x: 150, y: 250, s: 2, dir: 'up' }] });
  try {
    if (!o.after) await say(g, `（テレビをつけた。${rules.label}、決勝の生放送だ）`);
    const quick = (await ask(g, 'どう見る？', ['ダイジェストで見る', '結果だけ知る'], null, { cancel: 1 })) === 1;
    if (!quick) {
      for (const k of fin.order) {
        const a = actOf(m, y, k);
        const sc = fin.scores[k];
        set.studio.led = a.name;
        set.studio.ranking = fin.order.slice(0, fin.order.indexOf(k) + 1).map((x) => ({ key: x, name: actOf(m, y, x).name, total: fin.scores[x].total })).sort((p, q) => q.total - p.total).slice(0, 3);
        await say(g, `${rivalNarration(a, sc.s)}　…${sc.total}点`);
      }
    }
    await say(g, [`優勝は「${row.chN}」！${row.ruN ? `準優勝「${row.ruN}」、3位「${row.thN || ''}」。` : ''}`, row.revN ? `敗者復活は「${row.revN}」。最高得点は「${row.topN}」の${row.top}点。` : `最高得点は「${row.topN}」の${row.top}点。`]);
    await netCard(g, netPosts(g, y, row.chN, null, null, row.topN));
    const E = entryOf(g, y);
    const u = unitInfo(g, y);
    if (E && partnerWho(u)) await say(g, E.status === 'out' ? '…来年は、あっち側に立と。' : 'すごいな…。俺らも、いつか。', partnerWho(u));
  } finally { popSet(g, set); }
}

// ================================================================ ネタ合わせ (any day in the season)
export async function practiceFlow(g) {
  const m = M(g);
  const y = cal(g).year;
  const u = unitInfo(g, y);
  if (u.type === 'pin' || !u.partner) { await say(g, '（相方がいないと、ネタ合わせはできない）'); return false; }
  if (m.practicedDay === today(g)) { await say(g, '（今日のネタ合わせはもう終わった。休むのも稽古のうち）'); return false; }
  if (g.state.stamina < 10) { await say(g, '体力が足りない…。'); return false; }
  const set = pushSet(g, h01(today(g), 'pr') < 0.5 ? 'home' : 'night', { year: y, cast: [{ look: g.state.look, x: 290, y: 212, s: 2, dir: 'right' }, { look: u.partnerLook, x: 350, y: 212, s: 2, dir: 'left' }], caption: 'ネタ合わせ' });
  try {
    const neta = await chooseNeta(g, 240, 'ネタ合わせ', null, 0);
    g.state.stamina -= 10;
    const v = practice(g, neta, 6);
    m.practicedDay = today(g);
    safe(() => g.lifeTick({ hunger: -6, stress: 3 }));
    const E = entryOf(g, y);
    await netaAwase(g, E || { no: 0 }, u, neta, 0, 'ネタ合わせ');
    await say(g, `（「${neta ? neta.title : 'ネタ'}」を何度も通した。仕上がり ${Math.round(v || 0)}）`);
    if (u.partner) safe(() => g.addAff(u.partner, 1, true));
    return true;
  } finally { popSet(g, set); }
}

// ================================================================ after the final (days / months later)
export async function zadankaiFlow(g, y) {
  const E = entryOf(g, y);
  if (!E || !E.final) return;
  const u = unitInfo(g, y);
  const set = pushSet(g, 'talk', { year: y, sub: `M-1 アフター座談会`, cast: [{ look: g.state.look, x: 260, y: 200, s: 2 }].concat(u.partnerLook ? [{ look: u.partnerLook, x: 306, y: 200, s: 2 }] : []).concat([{ look: lookFor('m', 'zd', y), x: 420, y: 200, s: 2 }, { look: lookFor('f', 'zd2', y), x: 480, y: 200, s: 2 }]) });
  try {
    await say(g, ['（ファイナリストが集まって、決勝の夜を振り返る「M-1 アフター座談会」。年末の恒例企画だ）', `「${E.name}」の${E.final.champ ? '優勝' : `決勝${E.final.place || E.final.rank1}位`}の舞台裏を、ほかの組が語る。`]);
    const i = await ask(g, '「決勝の4分間、何を考えてました？」', ['「何も覚えてないです」', '「相方の顔だけ見てました」', '「審査員の顔がこわかった」'], null, { cancel: 0 });
    logLine(E, `アフター座談会で${['「何も覚えてない」', '「相方の顔だけ見てた」', '「審査員の顔がこわかった」'][Math.max(0, i)]}と語った。`);
    g.addFame(25, true); g.addFans(600, true);
    E.after.zadankai = true;
  } finally { popSet(g, set); }
}
export async function anotherStory(g, y) {
  const m = M(g);
  const E = m.me.entries[y];
  if (!E) { await say(g, '（その年のアナザーストーリーはない）'); return; }
  const looks = castOf(g, y, E).map((x) => x.look).filter(Boolean).slice(0, 2);
  const past = Object.values(m.me.entries).filter((x) => x.y < y).sort((a, b) => a.y - b.y);
  const title = `M-1グランプリ${y} アナザーストーリー　〜${E.name}〜`;
  await docPage(g, { title, looks, lines: [`結成${E.years}年目。${E.amateur ? 'アマチュアのふたり。' : `${E.agency}所属。`}`, E.last ? 'この年が、ラストイヤーだった。' : '', `エントリーナンバー${E.no}。全国${m1Rules(y).entriesText}のうちの、ひと組。`, ...past.map((p) => `${p.y}年：${p.results.length ? `${p.results[p.results.length - 1].round}${p.results[p.results.length - 1].passed ? '' : '敗退'}` : '出場'}`)].filter(Boolean) });
  const rounds = E.results.map((r) => `${r.round}　${r.city || ''}${r.hall ? '・' + r.hall : ''}　${r.score}点${r.passed ? '' : '（敗退）'}${r.wildcard ? '→ワイルドカード' : ''}`);
  await docPage(g, { title: 'それぞれの予選', looks, lines: rounds.length ? rounds : ['予選の記録はない。'] });
  const quotes = (E.log || []).slice(-10);
  await docPage(g, { title: 'カメラが見ていたもの', looks, lines: quotes.length ? quotes : ['（記録なし）'] });
  const end = E.final ? (E.final.champ ? [`決勝ファーストラウンド${E.final.rank1}位、${E.final.total}点。`, '最終決戦を制し、王者に。', `キャッチコピーは「${E.copy || ''}」。`, '「この日のために、全部があった」'] : [`決勝${E.final.place || E.final.rank1}位（${E.final.total}点）。優勝は「${E.final.champName}」。`, `キャッチコピーは「${E.copy || ''}」。`, '「また、ここに戻ってくる」']) : [`この年は${E.results.length ? E.results[E.results.length - 1].round : '予選'}で終わった。`, '「来年こそ」'];
  await docPage(g, { title: 'そして', looks, lines: end });
  if (E.after) E.after.another = true;
}
export async function returnsFlow(g, y) {
  const E = entryOf(g, y);
  if (!E || !E.final) return false;
  const rules = m1Rules(y);
  const u = unitInfo(g, cal(g).year);
  const set = pushSet(g, 'tour', { year: y, sub: 'M-1グランプリ リターンズ', cast: [{ look: g.state.look, x: 282, y: 222, s: 2 }].concat(u.partnerLook ? [{ look: u.partnerLook, x: 358, y: 222, s: 2 }] : []) });
  try {
    await say(g, ['（年が明けて、「M-1グランプリ リターンズ」の収録。決勝で披露できなかった「もう1本」を、ファイナリストがかける特番だ）']);
    const neta = await chooseNeta(g, 240, 'リターンズ（もう1本）', E.finalNeta, 0);
    tick(g, 15, 5);
    const res = await doPerform(g, { neta, length: 240, title: 'M-1グランプリ リターンズ', round: 'returns', contestName: rules ? rules.label : 'M-1', venueName: 'テレビ収録スタジオ', size: 'tv', crowd: 'warm', pressure: 40 });
    const pay = internal(rules && E.final.champ ? 300000 : 150000);
    g.addMoney(pay, true); g.addFame(40, true); g.addFans(1500, true);
    await say(g, `（収録終了。ランク${res.rank}。出演料 ${yenNom(rules && E.final.champ ? 300000 : 150000)}）`);
    E.after.returns = true;
    return true;
  } finally { popSet(g, set); }
}
export async function tourStop(g, y, stop) {
  const E = entryOf(g, y);
  if (!E || !E.final) return false;
  const u = unitInfo(g, cal(g).year);
  E.after.tour = E.after.tour || {};
  if (E.after.tour[stop.city]) { await say(g, '（この公演はもう終わった）'); return false; }
  const set = pushSet(g, 'tour', { year: y, sub: `M-1グランプリ${y} ツアー ${stop.city}公演`, cast: [{ look: g.state.look, x: 282, y: 222, s: 2 }].concat(u.partnerLook ? [{ look: u.partnerLook, x: 358, y: 222, s: 2 }] : []) });
  try {
    const i = await ask(g, `M-1ツアー ${stop.city}公演。ファイナリストが全国を回るツアーだ。`, ['ネタをやる', 'おまかせでやる', '今日は休演する'], null, { cancel: 2 });
    if (i === 2) return false;
    const neta = await chooseNeta(g, 240, `M-1ツアー ${stop.city}`, null, i === 1 ? 2 : 0);
    tick(g, 18, 6);
    const res = await doPerform(g, { neta, length: 240, title: `M-1ツアー ${stop.city}公演`, round: 'tour', contestName: 'M-1ツアー', venueName: `${stop.city}の劇場`, size: 'hall', crowd: 'warm', pressure: 30, skip: i === 1 });
    set.react = 1; sfx(g, 'laugh');
    const nominal = E.final.champ ? 200000 : 100000;
    g.addMoney(internal(nominal), true); g.addFame(30, true); g.addFans(2000, true);
    E.after.tour[stop.city] = res.rank;
    await say(g, `（${stop.city}公演、満員の客席が沸いた。ランク${res.rank}。ギャラ ${yenNom(nominal)}）`);
    news(g, 'tour', { city: stop.city }, { once: `tour_${y}_${stop.city}` });
    return true;
  } finally { popSet(g, set); }
}
export async function dvdRelease(g, y) {
  const m = M(g);
  const E = m.me.entries[y];
  const row = m.hist.find((h) => h.y === y);
  if (!row) return;
  const champMe = row.ch === 'me';
  const u = unitInfo(g, cal(g).year);
  const members = champMe ? u.members.map((x) => ({ look: x.look })) : (actOf(m, y, 'c:' + row.ch).members || []);
  await dvdCard(g, { year: y, name: row.chN, members, copy: E && E.copy && champMe ? E.copy : '' });
  if (E && E.final) {
    const sales = Math.round((champMe ? 42000 : 30000) + h01(m.seed, y, 'dvd') * 20000);
    const roy = internal(champMe ? 600000 : 120000);
    g.addMoney(roy, true);
    if (!g.hasItem('m1_dvd')) g.giveItem('m1_dvd', 1, true);
    await say(g, [`（${m1Rules(y).label}のDVDが発売された。売上は約${sales.toLocaleString('ja-JP')}枚）`, `（出演者印税として ${yenNom(champMe ? 600000 : 120000)} が振り込まれた）`]);
    E.after.dvd = { sales };
  }
}
export { meAct, doPerform, chooseNeta, houseNeta, showBoard };
export const _test = { reasonLines, judgeComment, rivalNarration, usedBefore };
