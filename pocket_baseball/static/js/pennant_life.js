/* 熱闘！ポケットベースボール — ペナント: 選手の状態と一軍・二軍 (L3)
 * ペナントはクイック対戦と別に球団の写し (pen.teams) を持つ (オーダー・登録の変更はクイック対戦に漏れない)。
 * 一軍 = 打順 (投手の枠を除く)・控え・先発ローテーション・ブルペンにいる選手。それ以外の支配下選手は二軍 (ケガ人は故障者)。
 * 調子・疲労・ケガは選手の p.st に持ち、試合のコピーの能力にだけ反映する (元の能力は変えない)。
 * 乱数 (ケガ・二軍の試合) は pen.seed と日・試合から作る (同じセーブからは同じ結果)。記事は保存した記録から作る。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const esc = U.esc;
  const N = () => PB.Pennant;
  const Store = () => PB.Store;
  const L = {};

  /* ---------- 2004 年の登録ルール (確度の低いものは要確認・ゲームの設定) ---------- */
  const R = (PB.RULES_2004 = PB.RULES_2004 || {});
  R.roster = {
    act: 28, // 一軍登録の上限
    bench: 25, // 試合のベンチ入り (一軍から先発予定以外の先発投手を外す)
    foreign: 4, // 一軍の外国人 (要確認)
    foreignP: 3, // うち投手 (要確認)
    foreignB: 3, // うち野手 (要確認)
    reDays: 10, // 登録抹消から 10 日間は再登録できない
    max: 70, // 支配下登録
    minC: 2, // 一軍の捕手 (ゲームの設定)
    minP: 12, // 一軍の投手 12〜13 人 (ゲームの設定)
    maxP: 13,
    rehab: 3, // ケガの回復後、二軍で調整する日数 (ゲームの設定)
    rest: 5, // 先発は前回の登板から 5 日目以降 (中4日以上)
    relRun: 3, // 救援は 3 日続けて投げたら翌日は休み
  };
  const RR = R.roster;
  L.RULES = RR;

  // 調子 (-2〜+2)。能力への反映は試合のコピーだけ: ミート・パワー ±2/±4、コントロール ±3/±6
  const COND_NAME = { 2: "絶好調", 1: "好調", 0: "普通", "-1": "不調", "-2": "絶不調" };
  const COND_ARROW = { 2: "↑", 1: "↗", 0: "→", "-1": "↘", "-2": "↓" };
  const COND_BAT = [0, 2, 4];
  const COND_CTL = [0, 3, 6];
  // 調子の元になる「好不調の値」(fm): 出場するたびに前の値を FORM_KEEP だけ残して今日の内容 (固定の式) を足し、
  // 1 日ごとに FORM_DAY ずつ 0 に戻る。|fm| が FORM_LV を超えると ±1・±2
  const FORM_KEEP = 0.75;
  const FORM_DAY = 0.93;
  const FORM_LV = [2.2, 3.8];
  L.COND_NAME = COND_NAME;
  // 投手の疲労 (投球数でたまり、毎日回復する)
  const FAT_TIRED = 30; // 疲れが残る (CPU はなるべく使わない)
  const FAT_OUT = 60; // 投げられない
  // ケガの部位と全治日数 [名前, 最短, 最長, 重み] (このゲームの表)
  const INJ_BAT = [
    ["打撲", 3, 10, 30],
    ["足首のねんざ", 7, 21, 14],
    ["腰の張り", 4, 12, 14],
    ["手首の炎症", 7, 18, 10],
    ["太ももの肉離れ", 14, 35, 12],
    ["わき腹の筋挫傷", 14, 30, 8],
    ["ひざの靱帯損傷", 30, 60, 4],
    ["骨折", 35, 75, 6],
  ];
  const INJ_PIT = [
    ["肩の張り", 5, 15, 22],
    ["ひじの張り", 7, 20, 18],
    ["腰の張り", 4, 12, 14],
    ["指のマメ", 3, 8, 14],
    ["わき腹の肉離れ", 14, 35, 12],
    ["肩の炎症", 21, 45, 10],
    ["ひじの靱帯損傷", 45, 90, 4],
    ["骨折", 35, 75, 4],
  ];
  const INJ_PA = 0.00045; // 打者: 1 打席あたり
  const INJ_PITCH = 0.00017; // 投手: 1 球あたり
  // 二軍のリーグ (2004 年の区分。二軍の成績は簡易計算)
  const FARM_LG = { g: "E", s: "E", yb: "E", l: "E", f: "E", m: "E", t: "W", d: "W", c: "W", bu: "W", bw: "W", h: "W" };
  const FARM_LG_NAME = { E: "イースタン・リーグ", W: "ウエスタン・リーグ" };
  L.farmLgName = (id) => FARM_LG_NAME[FARM_LG[id]] || "二軍";
  // 二軍の選手の名前に使わない姓 (派手な架空の姓・実在の 2004 年の選手と紛らわしい姓)
  const FLASHY = ["霧島", "雷電", "剛田", "鬼塚", "獅子堂", "鷹野", "白鳥", "赤星", "黒岩", "竜崎", "猪俣", "鶴田"];
  const FARM_BAT_POS = ["C", "SS", "CF", "2B", "3B", "RF", "C", "1B", "LF", "SS", "CF", "2B", "C", "3B", "RF", "LF", "1B", "SS", "CF", "2B", "3B", "LF", "RF", "C"];
  const REASON = { fill: "欠員の補充", swap: "好不調の入れ替え", back: "ケガから復帰", user: "監督の判断", trim: "登録枠", foreign: "外国人枠", inj: "ケガ" };

  /* ---------- 小物 ---------- */
  const isP = (p) => !!p && p.pos === "P";
  const n0 = (v) => v || 0;
  const st = (p) => p.st || (p.st = {});
  const clampAb = (v) => Math.round(U.clamp(v, 1, 100));
  // 暦の日 (2004 年の通し日。日付のない古いセーブは日程の日数)
  function dk(pen, day) {
    return pen.dates && pen.dates[day] != null ? pen.dates[day] : day;
  }
  L.dk = dk;
  function hash(a, b, c, d) {
    let h = 2166136261 >>> 0;
    for (const v of [a, b, c, d]) {
      h ^= ((v | 0) + 0x9e3779b9) >>> 0;
      h = Math.imul(h, 16777619) >>> 0;
      h ^= h >>> 13;
    }
    return h >>> 0;
  }
  function teamOf(pen, id) {
    return (pen.teams || []).find((t) => t.id === id) || null;
  }
  function pmap(team) {
    const m = {};
    for (const p of team.players) m[p.id] = p;
    return m;
  }
  // 一軍の選手 (打順の投手の枠は除く。投手はローテーションとブルペンから)
  function actIds(team) {
    const s = new Set();
    for (const e of team.lineup || []) if (e.pos !== "P" && e.id) s.add(e.id);
    for (const id of team.bench || []) s.add(id);
    for (const id of team.rotation || []) s.add(id);
    for (const id of team.bullpen || []) s.add(id);
    return s;
  }
  L.actIds = actIds;
  function counts(P, act) {
    const c = { n: 0, p: 0, b: 0, c: 0, fp: 0, fb: 0, f: 0 };
    for (const id of act) {
      const x = P[id];
      if (!x) continue;
      c.n++;
      if (isP(x)) {
        c.p++;
        if (x.foreign) c.fp++;
      } else {
        c.b++;
        if (x.pos === "C") c.c++;
        if (x.foreign) c.fb++;
      }
    }
    c.f = c.fp + c.fb;
    return c;
  }
  L.counts = (team) => counts(pmap(team), actIds(team));
  // 外国人枠: 一軍に add を足して drop を除いたときに枠に収まるか
  function foreignOK(P, act, add, drop) {
    let fp = 0;
    let fb = 0;
    for (const id of act) {
      const x = P[id];
      if (!x || !x.foreign || (drop && drop.id === id)) continue;
      if (isP(x)) fp++;
      else fb++;
    }
    if (add && add.foreign && !act.has(add.id)) {
      if (isP(add)) fp++;
      else fb++;
    }
    return fp + fb <= RR.foreign && fp <= RR.foreignP && fb <= RR.foreignB;
  }
  // 調子を反映した能力 (試合のコピー用。元の選手は変えない)
  function withCond(p) {
    const q = Object.assign({}, p);
    delete q.st;
    const c = (p.st && p.st.cond) || 0;
    if (!c) return q;
    const s = c > 0 ? 1 : -1;
    const a = Math.min(2, Math.abs(c));
    if (isP(p)) q.control = clampAb(p.control + s * COND_CTL[a]);
    else {
      q.meet = clampAb(p.meet + s * COND_BAT[a]);
      q.power = clampAb(p.power + s * COND_BAT[a]);
    }
    return q;
  }
  L.withCond = withCond;
  const val = (p) => (isP(p) ? D.pitOverall(p) : D.batOverall(p));
  // 調子を入れた評価 (コピーを作らずに差分だけ足す: 制球は pitOverall で ×0.9、ミート・パワーは batOverall で ×1.2 ずつ)
  function cdelta(p) {
    const c = (p.st && p.st.cond) || 0;
    if (!c) return 0;
    const s = c > 0 ? 1 : -1;
    const a = Math.min(2, Math.abs(c));
    return isP(p) ? 0.9 * s * COND_CTL[a] : 2.4 * s * COND_BAT[a];
  }
  const valC = (p) => val(p) + cdelta(p);
  const hitVal = (p) => n0(p.meet) * 1.2 + n0(p.power) * 1.3 + n0(p.speed) * 0.2 + (isP(p) ? 0 : cdelta(p) * 1.04);
  const spVal = (p) => (p.role === "SP" ? 30 : 0) + n0(p.stamina) * 0.8 + D.pitOverall(p) * 0.5;
  const clVal = (p) => (p.role === "CL" ? 25 : 0) + D.pitOverall(p) - n0(p.stamina) * 0.1;
  const autoOf = (pen, team) => team.id !== pen.my || !pen.life || pen.life.auto !== false;
  L.autoOf = autoOf;

  // 登録・抹消・ケガの記録 [日, 種類 (u 登録 / d 抹消 / i ケガ / r 回復), 球団, 選手, 理由・部位, 全治日数]
  function log(pen, day, k, tid, id, a, b) {
    const lf = ensure(pen);
    const e = [day, k, tid, id];
    if (a != null) e.push(a);
    if (b != null) e.push(b);
    lf.log.push(e);
  }
  function ensure(pen) {
    pen.life = pen.life || { auto: true, log: [], since: pen.day || 0 };
    pen.life.log = pen.life.log || [];
    pen.fstats = pen.fstats || {};
    return pen.life;
  }

  // 主力の並び (自動入れ替えはこれに戻す。CPU は開幕時の打順・ローテ、自チームは最後に決めたオーダー)
  function snapshot(t) {
    return { lineup: t.lineup.map((e) => ({ id: e.id, pos: e.pos })), rotation: t.rotation.slice(), closer: t.closer || null };
  }
  function baseSet(t) {
    const b = t.base || snapshot(t);
    const s = new Set();
    for (const e of b.lineup) if (e.pos !== "P" && e.id) s.add(e.id);
    for (const id of b.rotation) s.add(id);
    if (b.closer) s.add(b.closer);
    return s;
  }
  // 主力 (ニュースで他球団のケガを伝える選手)
  L.isStar = function (pen, tid, id) {
    const t = teamOf(pen, tid);
    return !!t && baseSet(t).has(id);
  };

  /* ---------- 登録・抹消 ---------- */
  function removeFrom(team, id) {
    for (const e of team.lineup) if (e.id === id && e.pos !== "P") e.id = null;
    team.bench = team.bench.filter((x) => x !== id);
    team.rotation = team.rotation.filter((x) => x !== id);
    team.bullpen = team.bullpen.filter((x) => x !== id);
    if (team.closer === id) team.closer = null;
  }
  function demote(pen, team, p, day, why) {
    removeFrom(team, p.id);
    const s = st(p);
    s.down = dk(pen, day);
    delete s.up;
    if (why === "inj") log(pen, day, "i", team.id, p.id, s.inj.n, s.inj.tot);
    else log(pen, day, "d", team.id, p.id, why);
  }
  function promote(pen, team, p, day, why) {
    if (isP(p)) team.bullpen.push(p.id);
    else team.bench.push(p.id);
    const s = st(p);
    delete s.down;
    delete s.rec;
    s.up = dk(pen, day);
    log(pen, day, "u", team.id, p.id, why);
  }
  // 一軍に上げられない理由 (上げられるときは null)。人数・外国人枠は別に見る
  function upBlock(pen, p, day) {
    const s = p.st || {};
    const today = dk(pen, day);
    if (s.inj) return p.name + "はケガで離脱中です（" + s.inj.n + "・残り" + s.inj.days + "日）";
    if (s.down != null && today - s.down < RR.reDays) return "登録抹消から10日間は再登録できません（" + p.name + "はあと" + (RR.reDays - (today - s.down)) + "日）";
    if (s.rec != null && today - s.rec < RR.rehab) return p.name + "はケガから回復して二軍で調整中です（あと" + (RR.rehab - (today - s.rec)) + "日）";
    return null;
  }
  L.upBlock = upBlock;
  // 二軍から上げられる選手 (kind: P 投手 / B 野手 / C 捕手)。調子を入れた能力の順
  function farmPool(pen, team, act, day, kind) {
    return team.players.filter((p) => !act.has(p.id) && !upBlock(pen, p, day) && (kind === "P" ? isP(p) : kind === "B" ? !isP(p) : kind === "C" ? p.pos === "C" : true)).sort((a, b) => valC(b) - valC(a));
  }

  /* ---------- 毎日の編成 (CPU 全球団・自チームは「自動入れ替え」がオンのとき) ---------- */
  // o.quick: ケガ人が出た直後などの最小限の修正 (主力の復帰・週 1 回の入れ替えはしない)
  L.manage = function (pen, team, day, o) {
    const opt = o || {};
    const auto = autoOf(pen, team);
    const P = pmap(team);
    // 1) ケガ人を一軍から外す
    for (const id of actIds(team)) if (P[id] && P[id].st && P[id].st.inj) demote(pen, team, P[id], day, "inj");
    // 2) 一軍 28 人・外国人枠を超えていたら外す (作成・移行のとき)
    trim(pen, team, P, day);
    // 3) ケガから戻れる主力を一軍へ
    if (auto && !opt.quick) restore(pen, team, P, day);
    // 4) 欠員の補充 (自動: 28 人まで。手動: 捕手 2 人・投手と野手 10 人ずつの最低限だけ)
    fill(pen, team, P, day, auto);
    // 5) 週に 1 回: 二軍の好調な選手と一軍の不調な選手を入れ替え
    if (auto && !opt.quick) weekly(pen, team, P, day);
    // 6) ローテーション・抑え・打順
    fixPitchers(team, P, auto);
    fixLineup(team, P, auto);
  };
  function lowest(list, base) {
    return list.sort((a, b) => (base.has(a.id) ? 1 : 0) - (base.has(b.id) ? 1 : 0) || valC(a) - valC(b))[0] || null;
  }
  function trim(pen, team, P, day) {
    const base = baseSet(team);
    let act = actIds(team);
    let c = counts(P, act);
    let guard = 0;
    // 外国人枠
    while ((c.f > RR.foreign || c.fp > RR.foreignP || c.fb > RR.foreignB) && guard++ < 10) {
      const kind = c.fp > RR.foreignP ? "P" : c.fb > RR.foreignB ? "B" : null;
      const cc = c;
      const drop = lowest(
        [...act].map((id) => P[id]).filter((p) => p && p.foreign && (!kind || (kind === "P") === isP(p)) && !(p.pos === "C" && cc.c <= RR.minC)),
        base
      );
      if (!drop) break;
      demote(pen, team, drop, day, "foreign");
      act = actIds(team);
      c = counts(P, act);
    }
    // 一軍 28 人
    while (c.n > RR.act && guard++ < 50) {
      const kind = c.p > RR.maxP ? "P" : c.b > RR.act - RR.maxP ? "B" : "P";
      const cc = c;
      const drop = lowest(
        [...act].map((id) => P[id]).filter((p) => p && (kind === "P") === isP(p) && !(p.pos === "C" && cc.c <= RR.minC)),
        base
      );
      if (!drop) break;
      demote(pen, team, drop, day, "trim");
      act = actIds(team);
      c = counts(P, act);
    }
  }
  function restore(pen, team, P, day) {
    const base = baseSet(team);
    for (const id of base) {
      const p = P[id];
      if (!p) continue;
      const act = actIds(team);
      if (act.has(id) || upBlock(pen, p, day)) continue;
      const c = counts(P, act);
      let drop = null;
      if (c.n >= RR.act) {
        // 28 人のときは同じ種類 (投手/野手) で主力でない一番低い選手と入れ替え
        drop = lowest(
          [...act].map((x) => P[x]).filter((q) => q && isP(q) === isP(p) && !base.has(q.id) && !(q.pos === "C" && p.pos !== "C" && c.c <= RR.minC)),
          base
        );
        if (!drop) continue;
      }
      if (!foreignOK(P, act, p, drop)) continue;
      if (drop) demote(pen, team, drop, day, "swap");
      promote(pen, team, p, day, "back");
    }
  }
  function fill(pen, team, P, day, auto) {
    for (let guard = 0; guard < 30; guard++) {
      let act = actIds(team);
      const c = counts(P, act);
      let kind = null;
      if (c.c < RR.minC) kind = "C";
      else if (auto) {
        if (c.n >= RR.act) break;
        kind = c.p < RR.minP ? "P" : c.b < RR.act - RR.maxP ? "B" : c.p < RR.maxP ? "P" : "B";
      } else if (c.p < 10) kind = "P";
      else if (c.b < 10) kind = "B";
      else break;
      let pool = farmPool(pen, team, act, day, kind).filter((p) => foreignOK(P, act, p, null));
      // 投手・野手のどちらかが尽きたらもう一方で (自動のときだけ)
      if (!pool.length && auto && kind !== "C") pool = farmPool(pen, team, act, day, kind === "P" ? "B" : "P").filter((p) => foreignOK(P, act, p, null));
      const pick = pool[0];
      if (!pick) break;
      if (c.n >= RR.act) {
        // 28 人で捕手が足りない: 捕手以外で一番低い野手と入れ替え
        const drop = lowest(
          [...act].map((id) => P[id]).filter((p) => p && !isP(p) && p.pos !== "C"),
          baseSet(team)
        );
        if (!drop) break;
        demote(pen, team, drop, day, "swap");
        act = actIds(team);
      }
      promote(pen, team, pick, day, "fill");
    }
  }
  function weekly(pen, team, P, day) {
    const today = dk(pen, day);
    if (team.lw != null && today - team.lw < 7) return;
    team.lw = today;
    const base = baseSet(team);
    for (const kind of ["P", "B"]) {
      const act = actIds(team);
      const c = counts(P, act);
      const hot = farmPool(pen, team, act, day, kind).filter((p) => n0(p.st && p.st.cond) >= 1);
      const cold = [...act]
        .map((id) => P[id])
        .filter((p) => p && (kind === "P") === isP(p) && !base.has(p.id) && n0(p.st && p.st.cond) <= -1 && team.rotation.indexOf(p.id) < 0 && p.id !== team.closer && !(p.pos === "C" && c.c <= RR.minC))
        .sort((a, b) => valC(a) - valC(b));
      const h = hot[0];
      const w = cold[0];
      if (!h || !w || valC(h) < valC(w) - 4) continue;
      if (!foreignOK(P, act, h, w)) continue;
      if (w.pos === "C" && h.pos !== "C" && c.c <= RR.minC) continue;
      demote(pen, team, w, day, "swap");
      promote(pen, team, h, day, "swap");
    }
  }
  // 先発ローテーション (5〜6 人)・抑え・ブルペンの並び (抑えは最後)
  function fixPitchers(team, P, auto) {
    const act = actIds(team);
    const pits = [...act].filter((id) => P[id] && isP(P[id]));
    const inAct = (id) => !!id && pits.indexOf(id) >= 0;
    const base = team.base || snapshot(team);
    let rot = ((auto && base.rotation) || team.rotation).filter(inAct);
    // 自動でも、今のローテーションにいる (補充した) 先発は後ろに残す
    if (auto) for (const id of team.rotation) if (inAct(id) && rot.indexOf(id) < 0) rot.push(id);
    let closer = (auto && base.closer) || team.closer;
    if (!inAct(closer)) closer = inAct(team.closer) ? team.closer : null;
    rot = rot.filter((id) => id !== closer);
    const want = U.clamp(((auto && base.rotation) || team.rotation).length || 5, 5, 6);
    while (rot.length > want) rot.pop();
    while (rot.length < want) {
      const c = pits
        .filter((id) => rot.indexOf(id) < 0 && id !== closer)
        .map((id) => P[id])
        .sort((a, b) => spVal(b) - spVal(a))[0];
      if (!c) break;
      rot.push(c.id);
    }
    if (!closer) {
      const c = pits
        .filter((id) => rot.indexOf(id) < 0)
        .map((id) => P[id])
        .sort((a, b) => clVal(b) - clVal(a))[0];
      closer = c ? c.id : null;
    }
    const bp = team.bullpen.filter((id) => inAct(id) && rot.indexOf(id) < 0 && id !== closer);
    for (const id of pits) if (rot.indexOf(id) < 0 && id !== closer && bp.indexOf(id) < 0) bp.push(id);
    if (closer) bp.push(closer);
    // 次の先発の指名 (rotIdx) は同じ投手を指すように
    if (team.rotation.join() !== rot.join()) {
      const cur = team.rotation.length ? team.rotation[(team.rotIdx || 0) % team.rotation.length] : null;
      const i = rot.indexOf(cur);
      team.rotIdx = i >= 0 ? i : (team.rotIdx || 0) % Math.max(1, rot.length);
    }
    team.rotation = rot;
    team.bullpen = bp;
    team.closer = closer;
  }
  // 守備位置ごとの代わり (同じ守備位置 → 近い守備位置の順)
  const FIT = {
    C: ["C"],
    "1B": ["1B", "3B", "LF", "RF", "DH", "2B", "CF", "SS"],
    "2B": ["2B", "SS", "3B", "CF"],
    "3B": ["3B", "SS", "2B", "1B"],
    SS: ["SS", "2B", "3B"],
    LF: ["LF", "RF", "CF", "1B"],
    CF: ["CF", "LF", "RF"],
    RF: ["RF", "LF", "CF"],
  };
  function bestFor(pos, free) {
    if (!free.length) return null;
    if (pos === "DH") return free.slice().sort((a, b) => hitVal(b) - hitVal(a))[0];
    const fit = FIT[pos] || [pos];
    let best = null;
    let bk = 1e9;
    let bv = -1e9;
    for (const p of free) {
      let k = fit.indexOf(p.pos);
      if (k < 0) k = pos === "C" ? 99 : 20;
      if (p.pos === "C" && pos !== "C") k += 30; // 捕手はなるべく他の守備位置に回さない
      const v = valC(p) + n0(p.field) * 0.3;
      if (k < bk || (k === bk && v > bv)) {
        best = p;
        bk = k;
        bv = v;
      }
    }
    return best;
  }
  // 打順: 主力の打順 (自動) または今の打順 (手動) から、いない選手の枠だけ控えで埋める
  function fixLineup(team, P, auto) {
    const act = actIds(team);
    const bats = [...act].map((id) => P[id]).filter((p) => p && !isP(p));
    const src = (auto && team.base && team.base.lineup) || team.lineup;
    const used = new Set();
    const out = src.map((e) => ({ id: e.id, pos: e.pos }));
    for (const e of out) {
      if (e.pos === "P") continue;
      if (e.id && act.has(e.id) && P[e.id] && !isP(P[e.id]) && !used.has(e.id)) used.add(e.id);
      else e.id = null;
    }
    // 捕手の枠から先に (捕手のいない打順にしない)
    const order = out.filter((e) => e.pos === "C").concat(out.filter((e) => e.pos !== "C" && e.pos !== "DH"), out.filter((e) => e.pos === "DH"));
    for (const e of order) {
      if (e.pos === "P" || e.id) continue;
      const pick = bestFor(
        e.pos,
        bats.filter((p) => !used.has(p.id))
      );
      if (pick) {
        e.id = pick.id;
        used.add(pick.id);
      }
    }
    const sp = team.rotation[(team.rotIdx || 0) % Math.max(1, team.rotation.length)] || team.rotation[0];
    for (const e of out) if (e.pos === "P") e.id = sp || e.id;
    team.lineup = out.filter((e) => e.id);
    const bench = team.bench.filter((id) => act.has(id) && !used.has(id) && P[id] && !isP(P[id]));
    for (const p of bats) if (!used.has(p.id) && bench.indexOf(p.id) < 0) bench.push(p.id);
    team.bench = bench;
  }
  L.fix = function (pen, team) {
    const P = pmap(team);
    fixPitchers(team, P, autoOf(pen, team));
    fixLineup(team, P, autoOf(pen, team));
  };

  /* ---------- 毎日の状態 (疲労の回復・ケガの日数・調子の戻り) ---------- */
  function daily(pen, day) {
    const lf = ensure(pen);
    const today = dk(pen, day);
    if (lf.lastDk != null && today <= lf.lastDk) return;
    const gap = lf.lastDk == null ? 0 : today - lf.lastDk;
    lf.lastDk = today;
    if (!gap) return;
    for (const t of pen.teams)
      for (const p of t.players) {
        const s = p.st;
        if (!s) continue;
        if (s.fat) {
          s.fat = Math.max(0, Math.round(s.fat - gap * (22 + n0(p.stamina) * 0.15)));
          if (!s.fat) delete s.fat;
        }
        if (s.inj) {
          // 暦の日数で減る
          s.inj.days -= gap;
          if (s.inj.days <= 0) {
            const inj = s.inj;
            delete s.inj;
            s.rec = today;
            log(pen, day, "r", t.id, p.id, inj.n);
          }
        }
        if (s.fm) {
          s.fm = r2(s.fm * Math.pow(FORM_DAY, gap));
          setCond(p, today);
        }
      }
  }
  // 試合の内容の点 (固定の式。平均的な内容でおよそ 0、-3〜+3)。sc: イニング数 / 9
  function formScore(p, b, started, sc) {
    let x;
    if (isP(p)) {
      if (!b.pg) return 0;
      const ip = n0(b.outs) / 3 / sc;
      if (started) x = (ip - 5.5) * 0.55 - (n0(b.er) / sc - 2.6) * 0.65;
      else x = ip * 0.7 - n0(b.pr) * 1.1 - 0.25;
    } else {
      if (!b.pa) return 0;
      const tb = n0(b.h) + n0(b.d) + 2 * n0(b.t) + 3 * n0(b.hr);
      x = tb + 0.7 * n0(b.bb) - 0.47 * n0(b.pa);
    }
    return U.clamp(x, -3, 3);
  }
  L.formScore = formScore;
  const r2 = (v) => Math.round(v * 100) / 100;
  // 好不調の値から調子の段階 (-2〜+2)
  function setCond(p, today) {
    const s = st(p);
    const f = n0(s.fm);
    const a = Math.abs(f) >= FORM_LV[1] ? 2 : Math.abs(f) >= FORM_LV[0] ? 1 : 0;
    const c = f < 0 ? -a : a;
    if (c !== n0(s.cond)) s.cd = today;
    if (c) s.cond = c;
    else delete s.cond;
    if (Math.abs(f) < 0.05) delete s.fm;
  }
  function addCond(p, x, today) {
    const s = st(p);
    s.fm = r2(n0(s.fm) * FORM_KEEP + x);
    setCond(p, today);
  }
  // 投球の記録 (疲労・連投)
  function pitched(p, np, today) {
    const s = st(p);
    s.fat = n0(s.fat) + n0(np);
    if (!s.fat) delete s.fat;
    s.run = s.last === today - 1 ? n0(s.run) + 1 : s.last === today ? n0(s.run) || 1 : 1;
    s.last = today;
  }
  const restOf = (p, today) => (p.st && p.st.last != null ? today - p.st.last : 99);
  // 救援として今日は投げられない (3 連投の翌日・疲労が大きい)
  function relOut(p, today) {
    const s = p.st || {};
    return (s.last === today - 1 && n0(s.run) >= RR.relRun) || n0(s.fat) >= FAT_OUT;
  }
  L.relOut = (p, pen) => relOut(p, dk(pen, pen.day));

  /* ---------- 先発・試合のコピー ---------- */
  // その日の先発: ローテーションの順に、中4日以上あいて疲れの残っていない投手。いなければブルペンから
  L.starter = function (pen, team, day) {
    const today = dk(pen, day);
    const P = pmap(team);
    const rot = team.rotation || [];
    const ok = (p) => p && !(p.st && p.st.inj) && restOf(p, today) >= RR.rest && n0(p.st && p.st.fat) < FAT_TIRED;
    for (let i = 0; i < rot.length; i++) {
      const id = rot[((team.rotIdx || 0) + i) % rot.length];
      if (ok(P[id])) return id;
    }
    // 先発が足りない日: ブルペンの投手で中4日以上あいた投手 (スタミナのある順)、それもいなければ一番休んだ投手
    const pits = actIdsList(team).filter((id) => isP(P[id]) && !(P[id].st && P[id].st.inj));
    const spot = pits
      .map((id) => P[id])
      .filter((p) => p.id !== team.closer && ok(p))
      .sort((a, b) => n0(b.stamina) - n0(a.stamina))[0];
    if (spot) return spot.id;
    const most = pits.map((id) => P[id]).sort((a, b) => restOf(b, today) - restOf(a, today) || n0(b.stamina) - n0(a.stamina))[0];
    return most ? most.id : rot[0];
  };
  const actIdsList = (team) => [...actIds(team)];
  // 試合に渡す球団のコピー: 一軍のケガのない選手だけ (調子を反映)、先発は 1 人、投げられない救援はブルペンから外す。
  // ベンチ入りは 25 人まで (先発予定以外の先発投手は入れない)
  L.gameTeam = function (pen, id, day) {
    const team = teamOf(pen, id);
    const today = dk(pen, day);
    let P = pmap(team);
    let act = actIds(team);
    const ok = (x) => !!x && act.has(x) && !!P[x] && !(P[x].st && P[x].st.inj);
    if (team.lineup.some((e) => e.pos !== "P" && !ok(e.id)) || !team.rotation.length) {
      L.manage(pen, team, day, { quick: true });
      P = pmap(team);
      act = actIds(team);
    }
    const sp = L.starter(pen, team, day);
    const c = Object.assign({}, team);
    delete c.base;
    delete c.lw;
    delete c.fg;
    c.lineup = team.lineup.map((e) => ({ id: e.pos === "P" ? sp : e.id, pos: e.pos }));
    c.bench = team.bench.filter((x) => ok(x) && x !== sp);
    c.rotation = [sp];
    let bp = team.bullpen.filter((x) => x !== sp && ok(x) && !relOut(P[x], today));
    const nBat = new Set(c.lineup.filter((e) => e.pos !== "P").map((e) => e.id).concat(c.bench)).size;
    // ベンチ入りの上限: 疲れの残る投手から外す
    while (1 + bp.length + nBat > RR.bench && bp.length) {
      const cand = bp.filter((x) => x !== team.closer).sort((a, b) => n0(P[b].st && P[b].st.fat) - n0(P[a].st && P[a].st.fat));
      const drop = cand.length ? cand[0] : bp[bp.length - 1];
      bp = bp.filter((x) => x !== drop);
    }
    c.bullpen = bp;
    c.closer = bp.indexOf(team.closer) >= 0 ? team.closer : null;
    const ids = new Set([sp].concat(bp, c.bench, c.lineup.filter((e) => e.pos !== "P").map((e) => e.id)));
    c.players = [...ids].map((x) => withCond(P[x]));
    const tired = bp.filter((x) => n0(P[x].st && P[x].st.fat) >= FAT_TIRED);
    return { team: c, starter: sp, tired };
  };

  /* ---------- 試合の後: 疲労・調子・ケガ ---------- */
  L.afterGame = function (pen, m, game, r) {
    if (!pen.teams) return;
    const day = pen.day;
    const today = dk(pen, day);
    const sc = (pen.innings || 9) / 9;
    for (const side of ["away", "home"]) {
      const team = teamOf(pen, side === "home" ? m.home : m.away);
      if (!team) continue;
      const P = pmap(team);
      game.used[side].forEach((id, i) => {
        const p = P[id];
        if (!p) return;
        const b = game.box[id] || {};
        pitched(p, b.np, today);
        addCond(p, formScore(p, b, i === 0, sc), today);
      });
      for (const q of game.teams[side].players) {
        if (isP(q)) continue;
        const b = game.box[q.id];
        const p = P[q.id];
        if (p && b && b.pa) addCond(p, formScore(p, b, false, sc), today);
      }
    }
    injuries(pen, m, game, r);
  };
  function pickInj(rng, table) {
    const tot = table.reduce((a, x) => a + x[3], 0);
    let x = rng.next() * tot;
    for (const e of table) {
      x -= e[3];
      if (x < 0) return e;
    }
    return table[0];
  }
  const ageF = (a) => (!a ? 1 : a >= 36 ? 1.7 : a >= 33 ? 1.35 : a <= 22 ? 0.9 : 1);
  // ケガ: 打席数・球数に比例した小さな確率 (年齢・連投で上がる)。乱数は pen.seed・日・試合から
  function injuries(pen, m, game, r) {
    const day = pen.day;
    const today = dk(pen, day);
    const rng = U.seeded(hash(pen.seed || 1, day, (r && r.gi) || 0, 11));
    for (const side of ["away", "home"]) {
      const team = teamOf(pen, side === "home" ? m.home : m.away);
      if (!team) continue;
      const P = pmap(team);
      const hurt = [];
      for (const q of game.teams[side].players) {
        const p = P[q.id];
        const b = game.box[q.id];
        if (!p || !b || (p.st && p.st.inj)) continue;
        let risk = 0;
        if (isP(p)) {
          if (b.np) risk = INJ_PITCH * b.np * (b.np > 110 ? 1.5 : 1) * (n0(p.st && p.st.run) >= 2 ? 1.3 : 1);
        } else if (b.pa) risk = INJ_PA * b.pa;
        if (!risk) continue;
        if (rng.next() < risk * ageF(p.age)) hurt.push(p);
      }
      for (const p of hurt) {
        const e = pickInj(rng, isP(p) ? INJ_PIT : INJ_BAT);
        L.injure(pen, team, p, e[0], rng.int(e[1], e[2]), day, true);
      }
      if (hurt.length) L.manage(pen, team, day, { quick: true });
    }
    void today;
  }
  // ケガ: 一軍なら抹消して故障者へ。自動入れ替えがオフの自チームは同じ種類の選手で穴を埋める (お知らせを出す)
  L.injure = function (pen, team, p, name, days, day, later) {
    st(p).inj = { n: name, days, tot: days, at: dk(pen, day), day };
    if (actIds(team).has(p.id)) {
      demote(pen, team, p, day, "inj");
      if (!autoOf(pen, team)) replaceLike(pen, team, p, day);
    }
    if (!later) L.manage(pen, team, day, { quick: true });
  };
  function replaceLike(pen, team, p, day) {
    const P = pmap(team);
    const act = actIds(team);
    const kind = p.pos === "C" ? "C" : isP(p) ? "P" : "B";
    const pick = farmPool(pen, team, act, day, kind).filter((x) => foreignOK(P, act, x, null))[0] || (kind === "C" ? farmPool(pen, team, act, day, "B").filter((x) => foreignOK(P, act, x, null))[0] : null);
    if (pick && counts(P, act).n < RR.act) promote(pen, team, pick, day, "fill");
  }

  /* ---------- 二軍の試合 (簡易計算: 打席ごとの確率・1 日 1 試合) ---------- */
  function paBat(b, rng) {
    const m = n0(b.meet);
    const k = U.clamp(0.185 - (m - 45) * 0.0025, 0.08, 0.34);
    const bb = U.clamp(0.08 + (m - 45) * 0.0006, 0.04, 0.13);
    const hr = U.clamp(0.012 + (n0(b.power) - 45) * 0.0009 + (n0(b.traj) - 2) * 0.004, 0.002, 0.07);
    const hit = U.clamp(0.305 + (m - 45) * 0.0025 + (n0(b.speed) - 50) * 0.0006, 0.22, 0.4);
    return outcome(rng, k, bb, hr, hit, 0.18 + (n0(b.power) - 50) * 0.002, 0.02 + (n0(b.speed) - 50) * 0.0006);
  }
  function paPit(p, rng) {
    const lv = (p.pitches || []).reduce((a, x) => a + x.lv, 0);
    const q = (n0(p.velo) - 140) * 0.006 + (n0(p.control) - 50) * 0.002 + (lv - 6) * 0.006;
    const k = U.clamp(0.18 + q, 0.08, 0.35);
    const bb = U.clamp(0.09 - (n0(p.control) - 50) * 0.0018, 0.03, 0.16);
    const hr = U.clamp(0.02 - q * 0.05, 0.006, 0.04);
    const hit = U.clamp(0.3 - q * 0.15, 0.22, 0.36);
    return outcome(rng, k, bb, hr, hit, 0.18, 0.02);
  }
  function outcome(rng, k, bb, hr, hit, d2, d3) {
    let x = rng.next();
    if ((x -= k) < 0) return "K";
    if ((x -= bb) < 0) return "BB";
    if ((x -= hr) < 0) return "HR";
    if (rng.next() < hit) {
      const y = rng.next();
      return y < U.clamp(d3, 0.005, 0.05) ? "3B" : y < U.clamp(d3, 0.005, 0.05) + U.clamp(d2, 0.1, 0.3) ? "2B" : "1B";
    }
    return rng.next() < 0.5 ? "GO" : "FO";
  }
  // 1 イニングの攻撃: pa() → { who, res }。onPA(who, res, rbi, scored, outs)
  function halfInning(rng, pa, onPA) {
    let outs = 0;
    let b1 = null;
    let b2 = null;
    let b3 = null;
    for (let guard = 0; outs < 3 && guard < 40; guard++) {
      const { who, res } = pa();
      const scored = [];
      let o = 0;
      if (res === "K" || res === "GO" || res === "FO") {
        o = 1;
        if (res === "GO" && b1 && outs < 2 && rng.next() < 0.12) {
          o = 2;
          b1 = null;
        } else if (res !== "K" && b3 && outs < 2 && rng.next() < 0.35) {
          scored.push(b3);
          b3 = null;
        }
      } else if (res === "BB") {
        if (b1) {
          if (b2) {
            if (b3) scored.push(b3);
            b3 = b2;
          }
          b2 = b1;
        }
        b1 = who || true;
      } else if (res === "1B") {
        if (b3) scored.push(b3);
        b3 = null;
        if (b2) {
          if (rng.next() < 0.6) scored.push(b2);
          else b3 = b2;
        }
        b2 = null;
        if (b1) {
          if (!b3 && rng.next() < 0.3) b3 = b1;
          else b2 = b1;
        }
        b1 = who || true;
      } else if (res === "2B") {
        if (b3) scored.push(b3);
        if (b2) scored.push(b2);
        b3 = null;
        if (b1) {
          if (rng.next() < 0.4) scored.push(b1);
          else b3 = b1;
        }
        b1 = null;
        b2 = who || true;
      } else if (res === "3B") {
        for (const x of [b3, b2, b1]) if (x) scored.push(x);
        b1 = b2 = null;
        b3 = who || true;
      } else if (res === "HR") {
        for (const x of [b3, b2, b1]) if (x) scored.push(x);
        scored.push(who || true);
        b1 = b2 = b3 = null;
      }
      outs += o;
      onPA(who, res, res === "K" || o === 2 ? 0 : scored.length, scored, o);
    }
  }
  const NP = { K: 5, BB: 5.5 };
  function farmGame(pen, team, day, rng) {
    const act = actIds(team);
    const today = dk(pen, day);
    const fs = pen.fstats || (pen.fstats = {});
    const farm = team.players.filter((p) => !act.has(p.id) && !(p.st && p.st.inj));
    const bats = farm.filter((p) => !isP(p)).sort((a, b) => valC(b) - valC(a));
    const pits = farm.filter(isP);
    if (bats.length < 9 || pits.length < 3) return;
    const fg = (team.fg = n0(team.fg) + 1);
    // 打順: 捕手 1 人 + 能力の高い 6 人 + 日替わりの 2 人 (二軍の選手にも出番を回す)
    const cs = bats.filter((p) => p.pos === "C");
    const c = cs.length ? cs[fg % Math.min(2, cs.length)] : null;
    const pool = bats.filter((p) => p !== c);
    const rest = pool.slice(6);
    const nine = (c ? [c] : []).concat(pool.slice(0, 6));
    for (let k = 0; nine.length < 9 && k < rest.length; k++) {
      const x = rest[(fg * 2 + k) % rest.length];
      if (nine.indexOf(x) < 0) nine.push(x);
    }
    for (const x of pool) if (nine.length < 9 && nine.indexOf(x) < 0) nine.push(x);
    nine.sort((a, b) => hitVal(b) - hitVal(a));
    const cq = new Map();
    const cond = (p) => {
      let q = cq.get(p);
      if (!q) cq.set(p, (q = withCond(p)));
      return q;
    };
    // 先発: 二軍の先発投手を順番に (中4日以上あいた投手)。救援は休めている順
    const sps = pits.filter((p) => p.role === "SP");
    let sp = null;
    for (let k = 0; k < sps.length && !sp; k++) {
      const x = sps[(fg + k) % sps.length];
      if (restOf(x, today) >= RR.rest) sp = x;
    }
    if (!sp) sp = pits.slice().sort((a, b) => restOf(b, today) - restOf(a, today))[0];
    const rels = pits.filter((p) => p !== sp && !relOut(p, today)).sort((a, b) => restOf(b, today) - restOf(a, today));
    const line = {};
    const ln = (p) => line[p.id] || (line[p.id] = { g: 1 });
    const add = (p, k, v) => {
      const x = ln(p);
      x[k] = n0(x[k]) + (v == null ? 1 : v);
    };
    let ours = 0;
    let opp = 0;
    let bi = 0;
    const order = [sp];
    let cur = sp;
    const spOuts = Math.round(12 + n0(sp.stamina) * 0.12) + rng.int(-2, 3);
    let ri = 0;
    const runsBy = {};
    for (let inn = 1; inn <= 9; inn++) {
      halfInning(
        rng,
        () => {
          const who = nine[bi++ % 9];
          return { who, res: paBat(cond(who), rng) };
        },
        (who, res, rbi, scored) => {
          add(who, "pa");
          if (res !== "BB") add(who, "ab");
          if (res === "K") add(who, "k");
          if (res === "BB") add(who, "bb");
          if (res === "1B" || res === "2B" || res === "3B" || res === "HR") add(who, "h");
          if (res === "2B") add(who, "d");
          if (res === "3B") add(who, "t");
          if (res === "HR") add(who, "hr");
          if (rbi) add(who, "rbi", rbi);
          for (const x of scored) if (x && x.id) add(x, "r");
          ours += scored.length;
        }
      );
      halfInning(
        rng,
        () => {
          // 継投: 先発は球数の目安か 5 失点まで、救援は 1〜2 回
          const x = ln(cur);
          const lim = cur === sp ? spOuts : 4 + (ri % 2) * 2;
          if ((n0(x.outs) >= lim || (cur === sp && n0(x.er) >= 5)) && ri < rels.length) {
            cur = rels[ri++];
            order.push(cur);
            add(cur, "pg");
          }
          return { who: cur, res: paPit(cond(cur), rng) };
        },
        (who, res, rbi, scored, o) => {
          add(who, "np", NP[res] || 3.6);
          if (o) add(who, "outs", o);
          if (res === "K") add(who, "pk");
          if (res === "BB") add(who, "pbb");
          if (res === "1B" || res === "2B" || res === "3B" || res === "HR") add(who, "ph");
          if (res === "HR") add(who, "phr");
          if (scored.length) {
            add(who, "er", scored.length);
            runsBy[who.id] = n0(runsBy[who.id]) + scored.length;
          }
          opp += scored.length;
        }
      );
    }
    add(sp, "pg");
    add(sp, "gs");
    // 勝敗 (簡易): 勝ちは 5 回以上投げた先発か一番長く投げた救援、負けは一番失点した投手
    if (ours !== opp) {
      if (ours > opp) {
        const w = n0(ln(sp).outs) >= 15 ? sp : order.slice(1).sort((a, b) => n0(ln(b).outs) - n0(ln(a).outs))[0] || sp;
        add(w, "w");
        const last = order[order.length - 1];
        if (last !== w && ours - opp <= 3 && order.length > 1) add(last, "sv");
      } else {
        const l = order.slice().sort((a, b) => n0(runsBy[b.id]) - n0(runsBy[a.id]))[0];
        add(l, "l");
      }
    }
    const P = pmap(team);
    for (const id in line) {
      const x = line[id];
      const p = P[id];
      if (x.np) x.np = Math.round(x.np);
      const t = fs[id] || (fs[id] = {});
      for (const k in x) t[k] = n0(t[k]) + x[k];
      if (isP(p)) pitched(p, x.np, today);
      addCond(p, formScore(p, x, p === sp, 1), today);
    }
  }
  L.afterDay = function (pen, day) {
    if (!pen.teams || day >= (pen.regDays || pen.schedule.length)) return;
    const ids = new Set();
    for (const m of pen.schedule[day] || []) {
      ids.add(m.home);
      ids.add(m.away);
    }
    pen.teams.forEach((t, i) => {
      if (ids.has(t.id)) farmGame(pen, t, day, U.seeded(hash(pen.seed || 1, day, i, 7)));
    });
  };

  /* ---------- 作成・移行 ---------- */
  // 球団の写し (定義の項目 = 名前・色・ロゴなどは今の定義を参照し、選手・オーダーは深いコピー)
  function copyTeam(t) {
    const def = D.teamDef ? D.teamDef(t.id) : null;
    const o = {};
    for (const k of Object.keys(t)) if (!def || k === "id" || !(k in def)) o[k] = t[k];
    const c = U.clone(o);
    if (def) for (const k of Object.keys(def)) c[k] = def[k];
    return c;
  }
  let realNames = null;
  // 実在選手 (名簿) の姓名。二軍の架空の選手はこれと同じ姓名にしない
  function realFullNames() {
    if (realNames) return realNames;
    realNames = new Set();
    for (const id in D.ROSTERS || {}) for (const r of D.ROSTERS[id].players || []) realNames.add(String(r.name || "").replace(/[ 　]/g, ""));
    return realNames;
  }
  L.realNames = realFullNames;
  function farmAdjust(p, age) {
    const a = age <= 20 ? -3 : age >= 27 ? 2 : 0;
    if (isP(p)) {
      p.velo = Math.round(U.clamp(p.velo + 3 + a, 120, 158));
      p.control = clampAb(p.control - 3 + a);
      for (const x of p.pitches || []) x.lv = U.clamp(x.lv - 1, 1, 7);
    } else {
      p.meet = clampAb(p.meet - 12 + a);
      p.power = clampAb(p.power - 6 + a);
      p.speed = clampAb(p.speed + 4);
      p.traj = U.clamp(Math.round(1.6 + (p.power - 40) / 22), 1, 4);
    }
  }
  // 二軍の架空の選手 (支配下 70 人まで・投手 20 人前後・野手 20 人前後・若手中心)
  function genFarm(pen, team, idx, fullUsed) {
    const rng = U.seeded(hash(pen.seed || 1, 404, idx, 3));
    const real = realFullNames();
    const surn = new Set(FLASHY);
    for (const p of team.players) surn.add(p.name);
    const nums = new Set(team.players.map((p) => p.num));
    const photos = (PB.PHOTOS && PB.PHOTOS[team.id]) || {};
    for (const k in photos) nums.add(Number(k));
    const pool = [];
    for (let n = 40; n <= 69; n++) pool.push(n);
    for (let n = 90; n <= 99; n++) pool.push(n);
    for (let n = 0; n <= 39; n++) pool.push(n);
    for (let n = 70; n <= 89; n++) pool.push(n);
    const free = pool.filter((n) => !nums.has(n));
    const room = Math.max(0, RR.max - team.players.length);
    const nP = Math.min(room, Math.max(14, 33 - team.players.filter(isP).length));
    const nB = room - nP;
    let k = 0;
    const make = (o) => {
      const age = (() => {
        const r = rng.next();
        return r < 0.45 ? rng.int(18, 21) : r < 0.85 ? rng.int(22, 25) : rng.int(26, 31);
      })();
      const p = D.genPlayer(rng, Object.assign({ tier: "bench", style: team.style, used: surn }, o));
      for (let g = 0; (real.has(p.name + p.given) || fullUsed.has(p.name + p.given)) && g < D.GIVEN.length; g++) p.given = D.GIVEN[(idx * 7 + k + g) % D.GIVEN.length];
      farmAdjust(p, age);
      p.id = team.id + "_f" + k;
      p.num = free.length ? free[k % free.length] : 99;
      p.full = p.name + p.given;
      p.age = age;
      p.foreign = false;
      p.gen = 1;
      p.st = {};
      fullUsed.add(p.full);
      team.players.push(p);
      k++;
    };
    for (let i = 0; i < nP; i++) make({ pos: "P", role: i < 8 ? "SP" : "RP" });
    for (let i = 0; i < nB; i++) make({ pos: FARM_BAT_POS[i % FARM_BAT_POS.length] });
  }
  // 状態・二軍・主力の並びを用意する (作成時と移行時に 1 回)
  function setup(pen) {
    ensure(pen);
    const fullUsed = new Set();
    for (const t of pen.teams)
      for (const p of t.players) {
        p.st = p.st || {};
        fullUsed.add(p.full || p.name);
      }
    const day = pen.day || 0;
    pen.teams.forEach((t, i) => {
      if (!t.players.some((p) => p.gen)) genFarm(pen, t, i, fullUsed);
      t.base = t.base || snapshot(t);
      // 週 1 回の入れ替えは球団ごとに曜日をずらす
      if (t.lw == null) t.lw = dk(pen, day) - 7 + (i % 7);
    });
    // 移行したセーブ: 前日までの登板から休養の日数を引き継ぐ
    if (day > 0 && pen.lastPitched)
      for (const t of pen.teams)
        for (const p of t.players) {
          const lp = pen.lastPitched[p.id];
          if (lp && lp.day != null && p.st.last == null) p.st.last = dk(pen, lp.day);
        }
    ensure(pen).lastDk = dk(pen, day);
    // 一軍 28 人・外国人枠・ローテーション・打順 (CPU も自チームも最初は同じ規則で)
    for (const t of pen.teams) {
      L.manage(pen, t, day, { quick: true });
      t.base = snapshot(t);
    }
  }
  L.init = function (pen) {
    const src = Store().teams().filter((t) => !pen.ids || pen.ids.indexOf(t.id) >= 0);
    pen.teams = src.map(copyTeam);
    setup(pen);
    if (PB.PenRecords) PB.PenRecords.ensure(pen);
  };
  // v3 → v4: 今の Store の球団を写す (今までの rotIdx・オーダーを引き継ぐ)。状態は既定値 (調子 0・疲労 0・ケガなし)
  L.migrate = function (pen) {
    if (!pen.teams) L.init(pen);
    else ensure(pen);
    if (PB.PenRecords) PB.PenRecords.ensure(pen);
  };

  /* ---------- フック ---------- */
  if (PB.Pennant && PB.Pennant.hooks) {
    PB.Pennant.hooks.beforeDay.push((pen, day) => {
      if (!pen.teams) return;
      daily(pen, day);
      for (const t of pen.teams) L.manage(pen, t, day);
    });
    PB.Pennant.hooks.afterGame.push((pen, m, game, r) => L.afterGame(pen, m, game, r));
    PB.Pennant.hooks.afterDay.push((pen, day) => L.afterDay(pen, day));
  }

  /* ---------- 手動の登録・抹消 (自チーム) ---------- */
  L.tryPromote = function (pen, id) {
    const team = teamOf(pen, pen.my);
    if (!team) return { msg: "球団が見つかりません" };
    const P = pmap(team);
    const p = P[id];
    const act = actIds(team);
    if (!p) return { msg: "選手が見つかりません" };
    if (act.has(id)) return { msg: p.name + "はすでに一軍です" };
    const why = upBlock(pen, p, pen.day);
    if (why) return { msg: why };
    if (counts(P, act).n >= RR.act) return { msg: "一軍は" + RR.act + "人までです。先に誰かを登録抹消してください" };
    if (!foreignOK(P, act, p, null)) return { msg: "外国人枠を超えます（一軍" + RR.foreign + "人・投手と野手はそれぞれ" + RR.foreignP + "人まで）" };
    promote(pen, team, p, pen.day, "user");
    fixPitchers(team, P, false);
    fixLineup(team, P, false);
    team.base = snapshot(team);
    return { ok: true, msg: p.name + "を一軍に登録しました" };
  };
  L.tryDemote = function (pen, id) {
    const team = teamOf(pen, pen.my);
    if (!team) return { msg: "球団が見つかりません" };
    const P = pmap(team);
    const p = P[id];
    const act = actIds(team);
    if (!p || !act.has(id)) return { msg: "一軍の選手ではありません" };
    const c = counts(P, act);
    if (p.pos === "C" && c.c <= RR.minC) return { msg: "一軍の捕手が" + RR.minC + "人より少なくなります" };
    if (isP(p) && c.p <= 10) return { msg: "一軍の投手が足りなくなります（10人以上）" };
    if (!isP(p) && c.b <= 10) return { msg: "一軍の野手が足りなくなります（10人以上）" };
    demote(pen, team, p, pen.day, "user");
    fixPitchers(team, P, false);
    fixLineup(team, P, false);
    team.base = snapshot(team);
    return { ok: true, msg: p.name + "を登録抹消しました（10日間は再登録できません）" };
  };
  // 自動入れ替えのオン・オフ
  L.setAuto = function (pen, on) {
    ensure(pen).auto = !!on;
    const team = teamOf(pen, pen.my);
    if (team) team.base = snapshot(team);
  };

  // オーダー画面 (一軍のケガのない選手だけを見せ、決定したら写しに戻す。クイック対戦の球団は変えない)
  L.orderScreen = function (pen, onBack) {
    const team = teamOf(pen, pen.my);
    const P = pmap(team);
    const act = actIds(team);
    const view = Object.assign({}, team, {
      players: [...act].map((id) => P[id]).filter((p) => p && !(p.st && p.st.inj)),
      lineup: team.lineup.map((e) => ({ id: e.id, pos: e.pos })),
      bench: team.bench.slice(),
      rotation: team.rotation.slice(),
      bullpen: team.bullpen.slice(),
    });
    const scr = PB.Screens.order(view, {
      onBack: () => {
        L.applyOrder(pen, team, view);
        Store().save();
        return PB.UI.go(onBack ? onBack() : N().hub());
      },
    });
    scr.pen = true;
    return scr;
  };
  L.applyOrder = function (pen, team, view) {
    for (const k of ["lineup", "bench", "rotation", "bullpen"]) team[k] = U.clone(view[k] || []);
    team.closer = view.closer || null;
    team.rotIdx = view.rotIdx || 0;
    const P = pmap(team);
    fixPitchers(team, P, false);
    fixLineup(team, P, false);
    // 決めたオーダーを主力の並びにする (自動入れ替えでも尊重する)
    team.base = snapshot(team);
  };

  /* ---------- 記事 (保存した記録から・乱数なし) ---------- */
  L.news = function (pen, day) {
    const out = [];
    if (!pen.life || !pen.teams) return out;
    const ev = pen.life.log.filter((e) => e[0] === day);
    if (!ev.length) return out;
    const Pn = N();
    const nm = (id) => {
      const f = Pn.findPlayer(id, pen);
      return f ? f.p.name : "?";
    };
    const tshort = (tid) => (teamOf(pen, tid) || { short: "?" }).short;
    const mine = ev.filter((e) => e[2] === pen.my);
    for (const e of mine)
      if (e[1] === "i") out.push({ key: "inj:" + day + ":" + e[3], day, kind: "inj", team: pen.my, pid: e[3], prio: 96, title: nm(e[3]) + "が負傷、登録抹消", body: e[4] + "で全治" + e[5] + "日の見込み" });
    const ups = mine.filter((e) => e[1] === "u");
    const downs = mine.filter((e) => e[1] === "d");
    if (ups.length || downs.length) {
      const title = [ups.length ? "一軍登録 " + ups.map((e) => nm(e[3])).join("・") : "", downs.length ? "登録抹消 " + downs.map((e) => nm(e[3])).join("・") : ""].filter(Boolean).join("、");
      const why = [...new Set(ups.concat(downs).map((e) => REASON[e[4]] || ""))].filter(Boolean).join("・");
      out.push({ key: "move:" + day, day, kind: "move", team: pen.my, prio: 58, title: tshort(pen.my) + "、" + title, body: why ? "理由: " + why : "" });
    }
    for (const e of mine) if (e[1] === "r") out.push({ key: "rec:" + day + ":" + e[3], day, kind: "move", team: pen.my, pid: e[3], prio: 52, title: nm(e[3]) + "がケガから回復", body: e[4] + "が治り、二軍で調整してから一軍へ（回復後" + RR.rehab + "日・抹消から" + RR.reDays + "日たてば登録できる）" });
    // 他球団: 主力のケガ・一軍復帰
    for (const e of ev) {
      if (e[2] === pen.my || !L.isStar(pen, e[2], e[3])) continue;
      if (e[1] === "i") out.push({ key: "inj:" + day + ":" + e[3], day, kind: "inj", team: e[2], pid: e[3], prio: 72, title: tshort(e[2]) + "の" + nm(e[3]) + "が負傷離脱", body: e[4] + "で全治" + e[5] + "日の見込み" });
      if (e[1] === "u" && e[4] === "back") out.push({ key: "back:" + day + ":" + e[3], day, kind: "move", team: e[2], pid: e[3], prio: 46, title: tshort(e[2]) + "の" + nm(e[3]) + "が一軍に復帰", body: "ケガから戻って登録" });
    }
    return out;
  };

  /* ---------- 画面 ---------- */
  const UI = () => PB.UI;
  function condBadge(p) {
    const c = n0(p.st && p.st.cond);
    return '<i class="pl-cd c' + (c < 0 ? "m" + -c : c) + '" title="' + COND_NAME[c] + '" aria-label="調子 ' + COND_NAME[c] + '">' + COND_ARROW[c] + "</i>";
  }
  L.condBadge = condBadge;
  L.condText = (p) => COND_NAME[n0(p.st && p.st.cond)];
  function batLine(s) {
    if (!s || !(s.pa || s.g)) return "-";
    return U.fmtAvg(n0(s.h), n0(s.ab)) + " " + n0(s.hr) + "本";
  }
  function pitLine(s, rel) {
    if (!s || !s.pg) return "-";
    const era = U.fmtERA(n0(s.er), n0(s.outs));
    if (rel && (s.sv || s.hld)) return era + " " + (s.sv ? s.sv + "S" : n0(s.hld) + "H");
    return era + " " + n0(s.w) + "勝" + n0(s.l) + "敗";
  }
  function age(p) {
    return p.age ? p.age + "歳" : "";
  }
  // 投手の状態の札 (次回先発・中N日・連投・休養・疲労)
  function pitTag(pen, team, p, nextSP) {
    const today = dk(pen, pen.day);
    const s = p.st || {};
    if (team.rotation.indexOf(p.id) >= 0) {
      if (p.id === nextSP) return '<span class="pl-tag gold">次回先発</span>';
      const r = restOf(p, today);
      return r < 99 ? '<span class="pl-tag">中' + Math.max(0, r - 1) + "日</span>" : "";
    }
    if (relOut(p, today)) return '<span class="pl-tag red">' + (n0(s.fat) >= FAT_OUT ? "疲労" : n0(s.run) + "連投") + "・休養</span>";
    if (n0(s.fat) >= FAT_TIRED) return '<span class="pl-tag warm">疲れ</span>';
    if (s.last === today - 1 && n0(s.run) >= 2) return '<span class="pl-tag">' + s.run + "連投</span>";
    return "";
  }
  function row(o) {
    return (
      '<div class="pl-row' +
      (o.cls ? " " + o.cls : "") +
      '"><span class="pl-pos">' +
      esc(o.pos) +
      '</span><span class="pl-nm" data-act="player" data-arg="' +
      esc(o.p.id) +
      '"><b>' +
      esc(o.p.name) +
      (o.p.foreign ? '<em class="pl-f">外</em>' : "") +
      "</b><small>" +
      (o.sub || "") +
      "</small></span>" +
      condBadge(o.p) +
      '<span class="pl-st">' +
      (o.stat || "") +
      "</span>" +
      (o.btn ? '<button class="btn sm pl-btn' + (o.btnCls ? " " + o.btnCls : "") + '" data-act="' + o.btn[0] + '" data-arg="' + esc(o.p.id) + '">' + o.btn[1] + "</button>" : "") +
      "</div>"
    );
  }
  const POS_GROUP = (p) => (isP(p) ? "P" : p.pos === "C" ? "C" : ["1B", "2B", "3B", "SS"].indexOf(p.pos) >= 0 ? "IF" : "OF");
  // 一軍・二軍・故障者の画面
  L.screen = function (o) {
    const opt = o || {};
    const pen = Store().data.pennant;
    const st0 = { tab: opt.tab || "act" };
    return {
      pen: true,
      cls: "pl-scr",
      html() {
        const team = teamOf(pen, pen.my);
        const P = pmap(team);
        const act = actIds(team);
        const c = counts(P, act);
        const auto = autoOf(pen, team);
        const today = dk(pen, pen.day);
        const inj = team.players.filter((p) => p.st && p.st.inj);
        const farm = team.players.filter((p) => !act.has(p.id) && !(p.st && p.st.inj));
        const nextSP = L.starter(pen, team, pen.day);
        let body = "";
        if (st0.tab === "act") {
          const S = pen.stats || {};
          const prow = (id, pos, role) => {
            const p = P[id];
            return row({ p, pos, sub: role + "・" + age(p) + pitTag(pen, team, p, nextSP), stat: pitLine(S[id], pos !== "先"), btn: ["down", "抹消"], btnCls: "ghost" });
          };
          const lineupIds = team.lineup.filter((e) => e.pos !== "P");
          body +=
            '<h3 class="lbl">投手 ' +
            c.p +
            '人</h3><div class="pl-list">' +
            team.rotation.map((id, i) => prow(id, "先", "先発" + (i + 1))).join("") +
            team.bullpen
              .filter((id) => id !== team.closer)
              .map((id) => prow(id, "中", "中継ぎ"))
              .join("") +
            (team.closer ? prow(team.closer, "抑", "抑え") : "") +
            "</div>" +
            '<h3 class="lbl">野手 ' +
            c.b +
            "人（捕手" +
            c.c +
            '）</h3><div class="pl-list">' +
            lineupIds.map((e, i) => row({ p: P[e.id], pos: D.POS_JP[e.pos] || e.pos, sub: (i + 1) + "番・" + (D.POS_FULL[P[e.id].pos] || "") + "・" + age(P[e.id]), stat: batLine(S[e.id]), btn: ["down", "抹消"], btnCls: "ghost" })).join("") +
            team.bench.map((id) => row({ p: P[id], pos: D.POS_JP[P[id].pos] || "", cls: "bench", sub: "控え・" + (D.POS_FULL[P[id].pos] || "") + "・" + age(P[id]), stat: batLine(S[id]), btn: ["down", "抹消"], btnCls: "ghost" })).join("") +
            "</div>";
          // 最近の登録・抹消
          const lg = (pen.life.log || []).filter((e) => e[2] === pen.my && e[1] !== "r").slice(-8).reverse();
          if (lg.length)
            body +=
              '<h3 class="lbl">最近の登録・抹消</h3><div class="pl-log">' +
              lg
                .map((e) => {
                  const p = P[e[3]] || { name: "?" };
                  const what = e[1] === "u" ? '<i class="up">登録</i>' : e[1] === "i" ? '<i class="inj">負傷</i>' : '<i class="dn">抹消</i>';
                  return "<p><span>" + esc(N().dayShort(pen, e[0])) + "</span>" + what + "<b>" + esc(p.name) + "</b><small>" + esc(e[1] === "i" ? e[4] + "・全治" + e[5] + "日" : REASON[e[4]] || "") + "</small></p>";
                })
                .join("") +
              "</div>";
        } else if (st0.tab === "farm") {
          const F = pen.fstats || {};
          const groups = [
            ["P", "投手"],
            ["C", "捕手"],
            ["IF", "内野手"],
            ["OF", "外野手"],
          ];
          body += groups
            .map(([g, label]) => {
              const list = farm.filter((p) => POS_GROUP(p) === g).sort((a, b) => valC(b) - valC(a));
              if (!list.length) return "";
              return (
                '<h3 class="lbl">' +
                label +
                " " +
                list.length +
                '人</h3><div class="pl-list">' +
                list
                  .map((p) => {
                    const s = p.st || {};
                    let tag = "";
                    if (s.down != null && today - s.down < RR.reDays) tag = '<span class="pl-tag">再登録まで' + (RR.reDays - (today - s.down)) + "日</span>";
                    else if (s.rec != null && today - s.rec < RR.rehab) tag = '<span class="pl-tag warm">調整中</span>';
                    const fl = F[p.id];
                    return row({ p, pos: D.POS_JP[p.pos] || "", cls: "farm", sub: age(p) + (p.gen ? "" : "・一軍経験") + tag, stat: '<span><i class="pl-fm">二軍</i>' + (isP(p) ? pitLine(fl, p.role !== "SP") : batLine(fl)) + "</span>", btn: ["up", "登録"] });
                  })
                  .join("") +
                "</div>"
              );
            })
            .join("");
          body += '<p class="note small">二軍の成績は簡易計算（打席ごとの確率・' + esc(L.farmLgName(team.id)) + "の区分のみ）。一軍の成績とは別に数えます。</p>";
        } else {
          const rec = farm.filter((p) => p.st && p.st.rec != null && today - p.st.rec < RR.rehab);
          body +=
            '<div class="pl-list">' +
            (inj.length
              ? inj
                  .sort((a, b) => a.st.inj.days - b.st.inj.days)
                  .map((p) =>
                    row({
                      p,
                      pos: D.POS_JP[p.pos] || "",
                      cls: "inj",
                      sub: esc(p.st.inj.n) + "・" + esc(N().dayShort(pen, p.st.inj.day)) + "から",
                      stat: '<span class="pl-left">残り<b>' + Math.max(0, p.st.inj.days) + "</b>日</span><small>全治" + p.st.inj.tot + "日</small>",
                    })
                  )
                  .join("")
              : '<p class="muted center">故障者はいません</p>') +
            "</div>" +
            (rec.length ? '<h3 class="lbl">回復して二軍で調整中</h3><div class="pl-list">' + rec.map((p) => row({ p, pos: D.POS_JP[p.pos] || "", cls: "farm", sub: "あと" + (RR.rehab - (today - p.st.rec)) + "日で調整終了", stat: "" })).join("") + "</div>" : "") +
            '<p class="note small">ケガの日数は暦の日数で減ります。回復したら二軍で' + RR.rehab + "日調整し、登録抹消から" + RR.reDays + "日たっていれば一軍に登録できます（ゲームの設定）。</p>";
        }
        const fp = c.fp;
        const fb = c.fb;
        return (
          UI().header("一軍・二軍", "back") +
          '<div class="scr-body pl-body"><div class="pl-sum">' +
          UI().mark(team, 28) +
          "<b>" +
          esc(team.short) +
          '</b><span class="pl-cnt' +
          (c.n >= RR.act ? " full" : "") +
          '">一軍<b>' +
          c.n +
          "</b>/" +
          RR.act +
          '</span><span class="pl-cnt">外国人<b>' +
          c.f +
          "</b>/" +
          RR.foreign +
          "<small>投" +
          fp +
          "・野" +
          fb +
          '</small></span><span class="pl-cnt">支配下<b>' +
          team.players.length +
          "</b>/" +
          RR.max +
          "</span></div>" +
          '<button class="pen-chk' +
          (auto ? " on" : "") +
          '" data-act="auto" role="switch" aria-checked="' +
          (auto ? "true" : "false") +
          '"><i></i><span>自動入れ替え<small>' +
          (auto ? "ケガ人の入れ替え・ローテや打順の修正・週1回の好不調の入れ替えをおまかせ" : "オフ: ケガ人が出たときの穴埋めだけ自動で行います") +
          "</small></span></button>" +
          PB.Screens.seg(
            "tab",
            [
              ["act", "一軍 " + c.n],
              ["farm", "二軍 " + farm.length],
              ["inj", "故障者 " + inj.length],
            ],
            st0.tab
          ) +
          body +
          '<p class="note small pl-rule">一軍登録は' +
          RR.act +
          "人まで（試合のベンチ入りは" +
          RR.bench +
          "人）。外国人は一軍" +
          RR.foreign +
          "人・投手と野手はそれぞれ" +
          RR.foreignP +
          "人まで（要確認）。登録抹消から" +
          RR.reDays +
          "日間は再登録できません。支配下登録は" +
          RR.max +
          "人まで。二軍の選手はこのゲームの架空の選手です。</p></div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI().go(opt.onBack ? opt.onBack() : N().hub());
        if (act === "tab") st0.tab = arg;
        else if (act === "player") return L.showPlayer(arg);
        else if (act === "auto") {
          L.setAuto(pen, !autoOf(pen, teamOf(pen, pen.my)));
          Store().save();
        } else if (act === "up" || act === "down") return L.move(pen, act, arg);
        UI().refresh();
      },
    };
  };
  // 登録・抹消 (トーストで結果・断られた理由)
  L.move = function (pen, act, id) {
    if (N().busy && N().busy()) return UI().toast("試合を消化中です");
    const f = N().findPlayer(id, pen);
    if (!f) return;
    const done = (r) => {
      UI().toast(r.msg, r.ok ? 1800 : 2600);
      if (r.ok) Store().save();
      UI().refresh();
      return r;
    };
    if (act === "up") return done(L.tryPromote(pen, id));
    // 抹消は確認してから (10 日間は戻せない)
    const pre = L.canDemote(pen, id);
    if (pre) return done({ msg: pre });
    UI().confirm(f.p.name + "を登録抹消します。10日間は再登録できません。よろしいですか？", () => done(L.tryDemote(pen, id)), { yes: "抹消する", danger: true });
  };
  L.canDemote = function (pen, id) {
    const team = teamOf(pen, pen.my);
    const P = pmap(team);
    const act = actIds(team);
    const p = P[id];
    if (!p || !act.has(id)) return "一軍の選手ではありません";
    const c = counts(P, act);
    if (p.pos === "C" && c.c <= RR.minC) return "一軍の捕手が" + RR.minC + "人より少なくなります";
    if (isP(p) && c.p <= 10) return "一軍の投手が足りなくなります（10人以上）";
    if (!isP(p) && c.b <= 10) return "一軍の野手が足りなくなります（10人以上）";
    return null;
  };

  // ハブの短い表示: 自チームの故障者・好調/不調の選手
  L.hubLine = function (pen) {
    const team = teamOf(pen, pen.my);
    if (!team) return "";
    const P = pmap(team);
    const act = [...actIds(team)].map((id) => P[id]).filter(Boolean);
    const inj = team.players.filter((p) => p.st && p.st.inj).sort((a, b) => b.st.inj.days - a.st.inj.days);
    const cd = (p) => n0(p.st && p.st.cond);
    const hot = act.filter((p) => cd(p) >= 1).sort((a, b) => cd(b) - cd(a) || val(b) - val(a));
    const cold = act.filter((p) => cd(p) <= -1).sort((a, b) => cd(a) - cd(b) || val(b) - val(a));
    const names = (list) => (list.length ? list.slice(0, 3).map((p) => esc(p.name) + condBadge(p)).join(" ") + (list.length > 3 ? '<small class="muted"> ほか' + (list.length - 3) + "人</small>" : "") : '<span class="muted">なし</span>');
    const auto = autoOf(pen, team);
    const fills = !auto ? (pen.life.log || []).filter((e) => e[2] === pen.my && e[1] === "u" && e[4] === "fill" && e[0] >= pen.day - 2) : [];
    return (
      '<div class="pl-hub" data-act="roster" role="button" aria-label="一軍・二軍を開く">' +
      '<p><span class="plh-k inj">故障者</span>' +
      (inj.length ? inj.slice(0, 2).map((p) => esc(p.name) + "<small>（" + esc(p.st.inj.n) + "・残り" + Math.max(0, p.st.inj.days) + "日）</small>").join("、") + (inj.length > 2 ? '<small class="muted"> ほか' + (inj.length - 2) + "人</small>" : "") : '<span class="muted">なし</span>') +
      "</p>" +
      '<p><span class="plh-k hot">好調</span>' +
      names(hot) +
      "</p>" +
      '<p><span class="plh-k cold">不調</span>' +
      names(cold) +
      "</p>" +
      (fills.length ? '<p class="plh-note">自動入れ替えはオフ: ケガ人の代わりに ' + fills.map((e) => esc((P[e[3]] || { name: "?" }).name)).join("・") + " を登録しました</p>" : "") +
      "</div>"
    );
  };

  // 選手の状態 (ペナント用の選手モーダルの中身)
  L.stateHTML = function (pen, team, p) {
    const today = dk(pen, pen.day);
    const act = actIds(team);
    const s = p.st || {};
    const where = s.inj ? "故障者" : act.has(p.id) ? "一軍" : "二軍";
    let role = "";
    if (act.has(p.id)) {
      if (team.rotation.indexOf(p.id) >= 0) role = "先発ローテーション";
      else if (team.closer === p.id) role = "抑え";
      else if (isP(p)) role = "中継ぎ";
      else if (team.lineup.some((e) => e.id === p.id && e.pos !== "P")) role = "スタメン";
      else role = "控え";
    }
    const c = n0(s.cond);
    const effect = c ? (isP(p) ? "コントロール" + (c > 0 ? "+" : "") + (c > 0 ? 1 : -1) * COND_CTL[Math.abs(c)] : "ミート・パワー" + (c > 0 ? "+" : "") + (c > 0 ? 1 : -1) * COND_BAT[Math.abs(c)]) : "";
    const rows = [];
    rows.push('<p><span class="plm-k">所属</span><b>' + esc(team.short) + " " + where + "</b>" + (role ? "<small>" + role + "</small>" : "") + (p.gen ? '<small class="muted">架空の選手</small>' : "") + "</p>");
    rows.push('<p><span class="plm-k">調子</span>' + condBadge(p) + "<b>" + COND_NAME[c] + "</b>" + (effect ? "<small>試合では " + effect + "</small>" : "") + "</p>");
    if (isP(p)) {
      const f = Math.min(100, Math.round((n0(s.fat) / FAT_OUT) * 100));
      const r = restOf(p, today);
      rows.push(
        '<p><span class="plm-k">疲労</span><span class="pl-fbar" role="img" aria-label="疲労 ' +
          f +
          '%"><i style="width:' +
          f +
          '%"></i></span><small>' +
          (r < 99 ? "前回の登板から" + r + "日" + (s.last === today - 1 && n0(s.run) >= 2 ? "・" + s.run + "連投" : "") : "今季の登板なし") +
          (relOut(p, today) ? "・今日は休養" : "") +
          "</small></p>"
      );
    }
    if (s.inj) rows.push('<p class="bad"><span class="plm-k">ケガ</span><b>' + esc(s.inj.n) + "</b><small>残り" + Math.max(0, s.inj.days) + "日（全治" + s.inj.tot + "日・" + esc(N().dayShort(pen, s.inj.day)) + "に負傷）</small></p>");
    const ub = !act.has(p.id) ? upBlock(pen, p, pen.day) : null;
    if (!s.inj && ub) rows.push('<p><span class="plm-k">登録</span><small>' + esc(ub) + "</small></p>");
    const fl = (pen.fstats || {})[p.id];
    let farm = "";
    if (fl)
      farm =
        '<h4 class="plm-h">二軍成績<small>簡易計算・' +
        esc(L.farmLgName(team.id)) +
        "</small></h4>" +
        (isP(p)
          ? '<div class="pc-stats"><span>登板<b>' + n0(fl.pg) + "</b></span><span>勝<b>" + n0(fl.w) + "</b></span><span>敗<b>" + n0(fl.l) + "</b></span><span>防御率<b>" + U.fmtERA(n0(fl.er), n0(fl.outs)) + "</b></span><span>回<b>" + U.fmtIP(n0(fl.outs)) + "</b></span><span>奪三振<b>" + n0(fl.pk) + "</b></span></div>"
          : '<div class="pc-stats"><span>試合<b>' + n0(fl.g) + "</b></span><span>打率<b>" + U.fmtAvg(n0(fl.h), n0(fl.ab)) + "</b></span><span>本塁打<b>" + n0(fl.hr) + "</b></span><span>打点<b>" + n0(fl.rbi) + "</b></span><span>安打<b>" + n0(fl.h) + "</b></span></div>");
    return '<div class="plm">' + rows.join("") + farm + "</div>";
  };

  // ペナント用の選手モーダル: 選手カード (能力・今季成績) + 状態・二軍成績・記録。自チームは登録・抹消も
  L.showPlayer = function (id) {
    const pen = Store().data.pennant;
    const f = pen && pen.teams ? N().findPlayer(id, pen) : null;
    if (!f) return UI().showPlayer(id, pen && pen.stats ? pen.stats[id] || null : null);
    const { p, team } = f;
    const mine = team.id === pen.my && !pen.finished;
    const act = actIds(team).has(id);
    const btn = mine ? (act ? '<button class="btn ghost" data-act="down">登録抹消</button>' : !(p.st && p.st.inj) ? '<button class="btn" data-act="up">一軍に登録</button>' : "") : "";
    UI().modal(
      (PB.Cards ? '<div class="pbslot"></div>' : "") +
        UI().playerCard(p, team, (pen.stats || {})[id] || null) +
        L.stateHTML(pen, team, p) +
        (PB.PenRecords ? PB.PenRecords.playerHTML(pen, p) : "") +
        '<div class="row-btns">' +
        btn +
        '<button class="btn primary" data-act="close">とじる</button></div>',
      {
        cls: "wide pl-modal",
        onAct(a) {
          if (a === "close") return UI().closeModal();
          if (a === "up" || a === "down") {
            UI().closeModal();
            L.move(pen, a, id);
          }
        },
        mount(box) {
          const slot = box.querySelector(".pbslot");
          if (slot && PB.Cards) slot.appendChild(PB.Cards.el(p, team, { w: Math.min(240, window.innerWidth - 100) }));
        },
      }
    );
  };

  // テスト用
  L._internal = { daily, pmap, counts, foreignOK, fixLineup, fixPitchers, trim, fill, restore, weekly, farmGame, injuries, formScore, addCond, setCond, snapshot, baseSet, genFarm, teamOf, restOf, relOut, FAT_TIRED, FAT_OUT, INJ_BAT, INJ_PIT };
  PB.PenLife = L;
})((window.PB = window.PB || {}));
