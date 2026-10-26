// 恋愛・結婚・家庭 (R12-L1) — the family at home: when you live with someone (同棲・結婚), they are in the room (and the children, and a baby's crib).
// Entities are added to the homes' rooms (home / mansion / tower) with `cond`, so they only show while the player lives there with them.
// Talking: a few lines by the time of day and the mood, then a small menu (おしゃべり / おでかけ / プレゼント); a child: play (romance_kids.js).
import { PLACES, buildRoom } from './map.js';
import { TILES } from './tiles.js';
import { TILE } from './util.js';
import { PEOPLE } from './life.js';
import { ITEMS } from './state.js';
import { clamp } from './util.js';
import * as D from './romance_data.js';
import { rom, leadRec, isCouple, shortName, recLook, eraOf, pgOf, addHist, kidAge, kidYears, kidLook, kidScale } from './romance.js';
import { charSheetHD } from './sprites.js';
import { chatFlow, giftFlow, giftsInBag, goDate, whyNotToday, spotsFor } from './romance_date.js';
import { playWithKid } from './romance_kids.js';
import { sayAs } from './romance_scene.js';

const game = () => (typeof globalThis !== 'undefined' && globalThis.__game) || null;
const HOMES = [['home', 'room'], ['mansion', 'apartment'], ['tower', 'apartment']];
const livesHere = (g, placeId) => { try { return g.housing().place === placeId; } catch (e) { return false; } };
const atHome = (g, placeId) => !!(g.map && g.map.placeId === placeId);
const partnerHere = (g, placeId) => {
  if (!g || !g.state || !atHome(g, placeId) || !livesHere(g, placeId)) return null;
  const l = leadRec(g);
  return l && (l.st === 'cohab' || l.st === 'married') ? l : null;
};
const kidsHere = (g, placeId) => {
  if (!g || !g.state || !atHome(g, placeId) || !livesHere(g, placeId)) return [];
  const R = rom(g);
  const l = leadRec(g);
  if (!l || l.st !== 'married') return [];
  return R.kids.filter((k) => !(R.home.kidsAway || []).includes(k.id));
};

// ---------------------------------------------------------------- finding a free tile
function freeTiles(room) {
  const used = new Set();
  for (const e of room.entities) if (e.x != null) { used.add(`${e.x},${e.y}`); if (e.w) for (let i = 0; i < e.w; i++) for (let j = 0; j < (e.h || 1); j++) used.add(`${e.x + i},${e.y + j}`); }
  for (const w of room.warps) used.add(`${w.x},${w.y}`);
  const out = [];
  for (let y = 2; y < room.h - 2; y++) {
    for (let x = 1; x < room.w - 1; x++) {
      const layers = room.cells[y][x];
      if (layers.some((id) => !TILES[id] || TILES[id].solid || TILES[id].obj)) continue;
      if (used.has(`${x},${y}`)) continue;
      // keep clear of the doors and the bottom row
      out.push([x, y]);
    }
  }
  const cx = room.w / 2, cy = room.h / 2;
  out.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  return out;
}

// ---------------------------------------------------------------- what they say
const MORNING = ['おはよう。朝ごはん、できてる{yo}。', 'おはよう。今日も、がんばって{ne}。', 'ん…おはよう。もう少し、寝かせて…。'];
const DAY = ['お仕事、いい感じ{no}？', 'お茶、いれよう{ka}。ひと息つこう{ne}。', '今日は、のんびりしてた{yo}。'];
const NIGHT = ['おかえり。おつかれさま。', 'おかえり！今日、{name}のこと考えてた{yo}。', 'お風呂、わいてる{yo}。'];
const COLD = ['…最近、ちゃんと話せてないね。', 'ねえ、今日は、ちょっとだけ話そう{yo}。'];
const WITH_BABY = ['さっき、やっと寝てくれた…。', 'この子、{name}の声がすると、泣きやむんだ{yo}。', 'ミルクの時間、そろそろ{da}。'];
async function talkLead(g, rec) {
  const R = rom(g), era = eraOf(g);
  const who = { name: rec.n, look: recLook(rec, era) };
  const ck = (() => { try { return g.clock(); } catch (e) { return null; } })();
  const ph = ck ? ck.phase : 'day';
  let line;
  if (rec.mo < 28) line = D.rngPick(R, COLD);
  else if (R.kids.some((k) => kidAge(g, k) < 1) && D.rngNext(R) < 0.5) line = D.rngPick(R, WITH_BABY);
  else if (ph === 'morning' || ph === 'early') line = D.rngPick(R, MORNING);
  else if (ph === 'night' || ph === 'late' || ph === 'evening') line = D.rngPick(R, NIGHT);
  else line = D.rngPick(R, DAY);
  line = line.replace('{ka}', 'か');
  await sayAs(g, who, D.sayLine(line, rec));
  const i = await g.ask(`${shortName(rec)}と…`, ['おしゃべりする', 'いっしょに出かける', 'プレゼントをわたす', 'なんでもない'], { ...who, cancel: 3 });
  if (i === 0) await chatFlow(g, rec);
  else if (i === 1) {
    const why = whyNotToday(g, rec);
    if (why) { await g.say(`（${why}）`); return; }
    const spots = spotsFor(g, rec).filter((s) => !s.why);
    if (!spots.length) { await g.say('（いまは、行けそうな場所がない）'); return; }
    const j = await g.list({ title: 'どこへ？', items: spots.map((s) => ({ label: s.name, right: s.price ? `¥${s.price.toLocaleString('ja-JP')}` : '無料' })), x: 24, y: 52, w: 420, px: true, cancel: -1 });
    if (j >= 0) await goDate(g, rec, spots[j].id, { kids: undefined });
  } else if (i === 2) {
    const ids = giftsInBag(g);
    if (!ids.length) { await g.say('（バッグに、プレゼントになるものがない）'); return; }
    const j = await g.list({ title: 'プレゼントは？', items: ids.map((id) => ({ label: ITEMS[id].name })), x: 24, y: 52, w: 300, px: true, cancel: -1 });
    if (j >= 0) await giftFlow(g, rec, ids[j]);
  }
}
const KID_LINE = {
  baby: ['（すやすや…。小さな寝息が、聞こえる）', '（ふにゃ、と笑った気がする）'],
  toddler: ['「{call}、だっこ！」', '「あのね、きょうね…えっとね…」', '「{call}、あそぼ！」'],
  child: ['「{call}、見て見て！」', '「ねえ、おなかすいた〜」', '「きょうね、学校でね…」'],
  teen: ['「…ただいま」', '「べつに、なんでもない」', '「ごはん、まだ？」'],
};
function callName(g) { const gdr = pgOf(g).gender; return gdr === 'm' ? 'パパ' : gdr === 'f' ? 'ママ' : g.state.name; }
async function talkKid(g, k) {
  const a = kidAge(g, k);
  const who = { name: k.n, look: kidLook(g, k) };
  const pool = a < 1 ? KID_LINE.baby : a < 6 ? KID_LINE.toddler : a < 13 ? KID_LINE.child : KID_LINE.teen;
  const line = D.rngPick(rom(g), pool).replace('{call}', callName(g));
  if (a < 1) await g.say(line); else await g.say(line, who);
  const i = await g.ask(a < 1 ? 'あやす？' : `${k.n}と遊ぶ？`, [a < 1 ? 'そっと抱っこする' : 'いっしょに遊ぶ', 'また今度'], { cancel: 1 });
  if (i === 0) await playWithKid(g, k);
}

// ---------------------------------------------------------------- install
function install() {
  for (const [pid, rid] of HOMES) {
    const place = PLACES[pid];
    if (!place || !place.rooms || !place.rooms[rid]) continue;
    let room;
    try { room = buildRoom(place, rid); } catch (e) { console.error('[romance_home]', e); continue; }
    if (room.__romHome) continue;
    room.__romHome = true;
    const free = freeTiles(room);
    if (!free.length) continue;
    const [lx, ly] = free[Math.min(2, free.length - 1)];
    const [k1x, k1y] = free[Math.min(5, free.length - 1)];
    const [k2x, k2y] = free[Math.min(8, free.length - 1)];
    const [bx, by] = free[Math.min(11, free.length - 1)];
    const lead = {
      type: 'npc', id: 'rom_lead', x: lx, y: ly, dir: 'down', wander: 1, name: 'パートナー',
      get look() { const g = game(); const r = g && g.state ? leadRec(g) : null; return r ? recLook(r, eraOf(g)) : {}; },
      cond: (g) => !!partnerHere(g, pid),
      talk: async (g) => { const r = leadRec(g); if (r) await talkLead(g, r); },
    };
    // a child: a small figure (a prop drawn at the child's size; NPC sprites are all grown-up size)
    const kid = (n, x, y) => ({
      type: 'prop', id: `rom_kid${n}`, x, y, w: 1, h: 1, solid: true, name: 'こども',
      cond: (g) => { const ks = kidsHere(g, pid).filter((k) => kidAge(g, k) >= 1); return ks.length >= n; },
      draw: (ctx, sx, sy, g) => {
        const ks = kidsHere(g, pid).filter((k) => kidAge(g, k) >= 1);
        const k = ks[n - 1];
        if (!k) return;
        const sc = Math.max(0.55, kidScale(g, k) || 0.6);
        const sheet = charSheetHD(kidLook(g, k));
        const im = sheet.down[0];
        const bob = Math.floor(g.frame / 24 + n) % 2;
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(sx + 3, sy + 14, 10, 1);
        ctx.drawImage(im, sx + 8 - 8 * sc, sy + 16 - 20 * sc - bob, 16 * sc, 20 * sc);
      },
      talk: async (g) => { const ks = kidsHere(g, pid).filter((k) => kidAge(g, k) >= 1); if (ks[n - 1]) await talkKid(g, ks[n - 1]); },
    });
    // a baby's crib (a prop): the bundle in a small bed
    const crib = {
      type: 'prop', x: bx, y: by, w: 1, h: 1, solid: true,
      cond: (g) => kidsHere(g, pid).some((k) => kidAge(g, k) < 1),
      draw: (ctx, sx, sy, g) => {
        ctx.fillStyle = '#c8b080'; ctx.fillRect(sx + 1, sy + 3, 14, 12);
        ctx.fillStyle = '#e8d8b0'; ctx.fillRect(sx + 2, sy + 5, 12, 9);
        ctx.fillStyle = '#fff0f4'; ctx.fillRect(sx + 4, sy + 8, 8, 5);
        ctx.fillStyle = '#f6c9a0'; ctx.fillRect(sx + 5, sy + 6, 5, 4);
        ctx.fillStyle = '#3a2a2a'; ctx.fillRect(sx + 6, sy + 8, 1, 1); ctx.fillRect(sx + 8, sy + 8, 1, 1);
        ctx.fillStyle = '#a89060'; ctx.fillRect(sx + 1, sy + 14, 14, 1);
      },
      talk: async (g) => { const k = kidsHere(g, pid).find((x) => kidAge(g, x) < 1); if (k) await talkKid(g, k); },
    };
    room.entities.push(lead, kid(1, k1x, k1y), kid(2, k2x, k2y), crib);
  }
}
let done = false;
export function installHomeNpcs() { if (done) return; done = true; try { install(); } catch (e) { console.error('[romance_home]', e); } }
installHomeNpcs();
