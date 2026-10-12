/* 熱闘！ポケットベースボール — ペナントの日程と日付 (2004 年の暦)
 * 日付は 2004 年の通し日 (1/1 = 0) で持つ。曜日・休日の並び (月曜休み・火〜木と金〜日の 3 連戦・
 * オールスター休み) だけ 2004 年風にした「架空の日程」で、実際の対戦カード・日付は再現しない。
 * セ・パはリーグごとに別々に並べるので、片方のリーグだけ試合がある日・休みの球団がある日もある。
 * ホーム・ロードは 2〜3 カードずつ交互 (連続は 9 試合まで)、主催は球団ごと・相手ごとに半々 (差 1 以内)。
 * 日程はペナントを始めるときに 1 回だけ作ってセーブに入れる (途中のペナントの日程は作り直さない)。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const S = {};

  S.YEAR = 2004;
  const JAN1_DOW = 4; // 2004/1/1 は木曜日
  const MDAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // うるう年
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];

  S.doy = function (m, d) {
    let n = d - 1;
    for (let i = 0; i < m - 1; i++) n += MDAYS[i];
    return n;
  };
  S.md = function (n) {
    let m = 0;
    let d = n;
    while (m < 11 && d >= MDAYS[m]) d -= MDAYS[m++];
    return { m: m + 1, d: d + 1 };
  };
  S.dow = (n) => (((JAN1_DOW + n) % 7) + 7) % 7;
  S.month = (n) => S.md(n).m;
  // 表示: 4月2日(金)
  S.label = function (n) {
    const x = S.md(n);
    return x.m + "月" + x.d + "日(" + DOW[S.dow(n)] + ")";
  };
  S.short = function (n) {
    const x = S.md(n);
    return x.m + "/" + x.d;
  };
  S.dowName = (n) => DOW[S.dow(n)];

  // 2004 年の日付 (確度の低いものは要確認。画面には「架空の日程」と出す)
  S.OPEN = { P: S.doy(3, 27), C: S.doy(4, 2) }; // 開幕日 (要確認: パ 3/27・セ 4/2 前後)
  S.END = { P: S.doy(9, 26), C: S.doy(10, 5) }; // フルの最終日の目安 (ゲームの設定)
  S.ALLSTAR = [S.doy(7, 9), S.doy(7, 12)]; // オールスター休み (要確認: 7 月中旬)
  S.STRIKE = [S.doy(9, 18), S.doy(9, 19)]; // 選手会のストライキで中止 (史実・振替なし)
  S.IL_START = S.doy(5, 7); // 交流戦 (後年ルール・2005 年方式) の開始の目安

  // ホーム・ロードの並びの決まり (日程の形の検査 tools/pennant_check.js もこの値を使う)
  S.RUN_MAX = 9; // ホーム・ロードの連続は 9 試合 (3 連戦 × 3) まで
  S.OPEN_AWAY = 3; // 開幕からのロードは 3 カードまで (なるべく 2 カードまで)

  // 試合数の区分: 組ごとの対戦数
  S.LENS = {
    s10: { name: "10試合", perPair: 2 },
    s20: { name: "20試合", perPair: 4 },
    s30: { name: "30試合", perPair: 6 },
    half: { name: "ハーフ", perPair: 14 },
    full: { name: "フル", perPair: { C: 28, P: 27 } },
  };
  S.isShort = (len) => /^s\d+$/.test(len || "");

  function perPairOf(opts, lg) {
    const L = S.LENS[opts.len] || S.LENS.s20;
    if (opts.len === "full" && opts.il) return 22; // 交流戦あり: リーグ内 22 試合 × 5 + 交流戦 36 = 146
    return typeof L.perPair === "number" ? L.perPair : L.perPair[lg] || 28;
  }

  // 1 組の対戦をカード (連戦) に分ける: 主催 A/B を交互にし、主催試合数の差を 1 以内に
  function split(h) {
    const q = Math.floor(h / 3);
    const r = h % 3;
    if (r === 0) return new Array(q).fill(3);
    if (r === 2) return new Array(q).fill(3).concat([2]);
    if (q === 0) return [1];
    return new Array(q - 1).fill(3).concat([2, 2]);
  }
  S.cards = function (n) {
    const a = split(Math.ceil(n / 2));
    const b = split(Math.floor(n / 2));
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) out.push({ L: a[i], A: true });
      if (b[i]) out.push({ L: b[i], A: false });
    }
    return out;
  };

  // 総当たりの組 (円形方式)。返り値は回ごとの組 [[a, b]...] (主催はあとで決める)
  function roundRobin(ids) {
    const arr = ids.slice();
    const n = arr.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const day = [];
      for (let i = 0; i < n / 2; i++) day.push([arr[i], arr[n - 1 - i]]);
      rounds.push(day);
      arr.splice(1, 0, arr.pop());
    }
    return rounds;
  }

  // 暦を「火〜木」「金〜日」のブロックに分ける (月曜・オールスター休み・除外日は入れない)
  function blocksFrom(start, end, skip) {
    const out = [];
    let cur = null;
    for (let n = start; n <= end; n++) {
      const w = S.dow(n);
      if (w === 1) continue;
      const kind = w >= 2 && w <= 4 ? "tt" : "fs";
      const key = n - ((w + 6) % 7) + kind; // その週の月曜 + 種類
      if (!cur || cur.key !== key) {
        cur = { key, kind, days: [], all: [] };
        out.push(cur);
      }
      cur.all.push(n);
      if (!skip(n)) cur.days.push(n);
    }
    return out.filter((b) => b.days.length);
  }
  const inAllStar = (n) => n >= S.ALLSTAR[0] && n <= S.ALLSTAR[1];
  const inStrike = (n) => n >= S.STRIKE[0] && n <= S.STRIKE[1];

  // 連戦 (L 試合の回) の並びをブロックに詰め、回ごとの日付を返す。fs (週末) で余るときは後ろ (土日) に寄せる
  function assign(Ls, blocks, offSet) {
    const at = [];
    let bi = 0;
    let ri = 0;
    while (ri < Ls.length) {
      while (bi < blocks.length && offSet.has(bi)) bi++;
      if (bi >= blocks.length) {
        // 暦が足りない: ブロックを後ろに足す
        const last = blocks.length ? blocks[blocks.length - 1].all[blocks[blocks.length - 1].all.length - 1] : S.OPEN.C;
        const more = blocksFrom(last + 1, last + 14, inAllStar);
        if (!more.length) break;
        blocks.push(...more);
        continue;
      }
      const b = blocks[bi];
      const cap = b.days.length;
      const take = [];
      let used = 0;
      while (ri < Ls.length && used + Ls[ri] <= cap) {
        take.push(ri);
        used += Ls[ri];
        ri++;
      }
      if (!take.length) {
        // このブロックには入らない (開幕直後の 2 日だけのブロックなど)
        bi++;
        continue;
      }
      const days = b.kind === "fs" ? b.days.slice(cap - used) : b.days.slice(0, used);
      let k = 0;
      for (const j of take) {
        at[j] = days.slice(k, k + Ls[j]);
        k += Ls[j];
      }
      bi++;
    }
    for (let j = 0; j < Ls.length; j++) at[j] = at[j] || [];
    return at;
  }

  // 詰めるのに要るブロック数
  function blocksNeeded(Ls, caps) {
    let n = 0;
    let ri = 0;
    let bi = 0;
    while (ri < Ls.length) {
      const cap = caps[Math.min(bi, caps.length - 1)] || 3;
      let used = 0;
      let any = false;
      while (ri < Ls.length && used + Ls[ri] <= cap) {
        used += Ls[ri];
        ri++;
        any = true;
      }
      bi++;
      if (any) n++;
      if (bi > 1000) break;
    }
    return n;
  }

  // 巡 (総当たり 1 回分) の長さの並び。短い巡 (2 連戦) は間に散らし、最初と最後は長い巡に
  // (終盤のストライキの週末に 2 連戦が当たると 2 試合とも消え、主催を半々にできない)。avoid の位置にも置かない。
  // 開幕のブロックが短い (土曜開幕など) ときは、入る長さの巡を先頭に
  function cycleOrder(Ls, cap0, avoid) {
    const maxL = Math.max(...Ls);
    let shorts = Ls.filter((L) => L < maxL).sort((a, b) => b - a);
    if (!shorts.length) return Ls.slice();
    const out = new Array(Ls.length).fill(0);
    if (maxL > cap0) {
      const k = shorts.findIndex((L) => L <= cap0);
      if (k >= 0) {
        out[0] = shorts[k];
        shorts = shorts.filter((L, i) => i !== k);
      }
    }
    const room = Math.max(1, Ls.length - 2);
    shorts.forEach((L, j) => {
      let p = 1 + Math.floor(((j + 0.5) * room) / shorts.length);
      while (p < out.length && (out[p] || avoid.has(p) || p === out.length - 1)) p++;
      if (p >= out.length) p = out.findIndex((x, i) => !x && !avoid.has(i));
      if (p < 0) p = out.indexOf(0);
      out[p] = L;
    });
    return out.map((L) => L || maxL);
  }

  /* ---------- 対戦の並び (どの回にどの組が当たるか) ---------- */
  // 1 巡 = 総当たり 1 回分 (円形方式を球団の並びを変えて)。巡の境目で同じ組が続かないようにし、
  // 2 回あとに同じ組が来るのもなるべく避ける
  function pairingSeq(ids, nCycles, rnd) {
    const out = [];
    const keyOf = (p) => (p[0] < p[1] ? p[0] + "|" + p[1] : p[1] + "|" + p[0]);
    const has = (round, keys) => round.some((p) => keys.has(keyOf(p)));
    for (let c = 0; c < nCycles; c++) {
      const rr = roundRobin(U.shuffle(ids.slice(), rnd));
      const k1 = new Set(out.length ? out[out.length - 1].map(keyOf) : []);
      const k2 = new Set(out.length > 1 ? out[out.length - 2].map(keyOf) : []);
      let best = null;
      let bad = 1e9;
      for (let t = 0; t < 8 && bad > 0; t++) {
        const ord = U.shuffle(rr.slice(), rnd);
        const b = (has(ord[0], k1) ? 100 : 0) + (has(ord[0], k2) ? 1 : 0) + (ord[1] && has(ord[1], k1) ? 1 : 0);
        if (b < bad) {
          best = ord;
          bad = b;
        }
      }
      if (bad >= 100) {
        // 同じ組が続く: 前の回と重ならない回を先頭に (1 巡の各回は重ならないので必ずある)
        const j = best.findIndex((r) => !has(r, k1));
        const t = best[0];
        best[0] = best[j];
        best[j] = t;
      }
      out.push(...best);
    }
    return out;
  }

  /* ---------- 交流戦 (後年ルール) の対戦と主催 ----------
   * 各リーグを 2 組 (a・b) に分け、ホーム・ロードを 2 カードずつ交互に (a: HHAA…、b: AAHH… / HAAH…、AHHA…)。
   * 4 回で一回りし、同じ組どうしの 3×3 をラテン方陣で回すと、全 36 組が主催 1 回ずつ (各 6 試合) になる */
  function interleague(A, B) {
    const h = A.length / 2;
    const ca = A.slice(0, h);
    const cb = A.slice(h);
    const pa = B.slice(0, h);
    const pb = B.slice(h);
    const out = [];
    const nm = A.length * 2;
    const shift = h > 2 ? h - 1 : 0; // 2 回あとに同じ組が来ないずらし方
    for (let s = 0; s < nm; s++) {
      const t = Math.floor(s / 4);
      const games = [];
      const vs = (X, Y, off, xHome) =>
        X.forEach((x, i) => {
          const y = Y[(i + off) % h];
          games.push(xHome ? { home: x, away: y, il: 1 } : { home: y, away: x, il: 1 });
        });
      const r = s % 4;
      if (r === 0) {
        vs(ca, pb, t % h, true);
        vs(cb, pa, t % h, false);
      } else if (r === 1) {
        vs(ca, pa, t % h, true);
        vs(cb, pb, t % h, false);
      } else if (r === 2) {
        vs(ca, pb, (t + shift) % h, false);
        vs(cb, pa, (t + shift) % h, true);
      } else {
        vs(ca, pa, (t + shift) % h, false);
        vs(cb, pb, (t + shift) % h, true);
      }
      out.push(games);
    }
    return out;
  }

  /* ---------- 主催の割り当て ----------
   * slots[k] = { pairs: [[a, b]...] (球団の番号), le: 実際に行う試合数 (ストライキの分は除く) }
   * E[i] = 回 i の前に入る決まった試合 (交流戦): [{ side: [1 = ホーム / 0 = ロード ...], le }] (E[N] は最後の回のあと)
   * 1) 組ごとに主催の試合数を半々にした初期値を作る (奇数の組は、球団ごとの合計も半々になるよう多い側を決める)。
   * 2) 同じ組・同じ試合数の 2 カードの主催を入れ替える (半々は崩れない) 焼きなましで、9 試合を超える連続・
   *    開幕からの長いロードを無くし、1 カードだけの入れ替わり・4 カード以上の連続を減らす。
   * 返り値: 回ごとの向き (ビット i が 1 なら pairs[i] の b が主催) */
  // 和が t になる部分集合をランダムに 1 つ (ls: 各要素の試合数)。無ければ null
  function subsetSum(ls, t, rnd) {
    const reach = [new Set([0])];
    ls.forEach((v, j) => {
      const s = new Set(reach[j]);
      for (const x of reach[j]) s.add(x + v);
      reach.push(s);
    });
    if (t < 0 || !reach[ls.length].has(t)) return null;
    const take = ls.map(() => false);
    for (let j = ls.length - 1; j >= 0; j--) {
      const skipOk = reach[j].has(t);
      const takeOk = t >= ls[j] && reach[j].has(t - ls[j]);
      if (takeOk && (!skipOk || rnd() < 0.5)) {
        take[j] = true;
        t -= ls[j];
      }
    }
    return take;
  }
  function orient(n, slots, E, rnd, iters) {
    const N = slots.length;
    const m = n / 2;
    // 対戦 q = k * m + i (回 k の i 番目の組): A・B = 両球団、Lq = 試合数。host[q] = 1 なら B が主催
    const A = [];
    const B = [];
    const Lq = [];
    slots.forEach((sl, k) =>
      sl.pairs.forEach(([a, b], i) => {
        A[k * m + i] = a;
        B[k * m + i] = b;
        Lq[k * m + i] = sl.le;
      })
    );
    const host = new Uint8Array(N * m);
        // 組ごとの対戦 (p = 小さい番号 * n + 大きい番号)
    const meets = {};
    for (let q = 0; q < N * m; q++) {
      const p = Math.min(A[q], B[q]) * n + Math.max(A[q], B[q]);
      (meets[p] || (meets[p] = [])).push(q);
    }
    const plist = Object.keys(meets).map(Number);
    const G = {};
    for (const p of plist) G[p] = meets[p].reduce((s, q) => s + Lq[q], 0);
    // 球団ごとの試合数と決まった試合のホーム数
    const T = new Array(n).fill(0);
    const FH = new Array(n).fill(0);
    for (const evs of E)
      for (const ev of evs)
        for (let x = 0; x < n; x++) {
          T[x] += ev.le;
          FH[x] += ev.side[x] ? ev.le : 0;
        }
    for (let q = 0; q < N * m; q++) {
      T[A[q]] += Lq[q];
      T[B[q]] += Lq[q];
    }
    // 奇数の組で 1 試合多く主催する側: ほぼ同じ数ずつになる総当たりの向き。球団ごとの合計が半々に収まるものを選ぶ
    let big = {};
    for (let t = 0; t < 60; t++) {
      const pos = [];
      U.shuffle([...Array(n).keys()], rnd).forEach((x, i) => (pos[x] = i));
      const b2 = {};
      const home = FH.slice();
      for (const p of plist) {
        const a = Math.floor(p / n);
        const b = p % n;
        const d = (((pos[b] - pos[a]) % n) + n) % n;
        b2[p] = d < n / 2 || (d === n / 2 && pos[a] < n / 2) ? a : b;
        home[a] += Math.floor(G[p] / 2);
        home[b] += Math.floor(G[p] / 2);
        if (G[p] % 2) home[b2[p]]++;
      }
      big = b2;
      if (home.every((h, x) => Math.abs(2 * h - T[x]) <= 1)) break;
    }
    // 初期値: 組ごとに主催を半々 (作れない和のときは一番近い和)
    for (const p of plist) {
      const qs = meets[p];
      const a = Math.floor(p / n);
      const want = G[p] % 2 ? (G[p] + (big[p] === a ? 1 : -1)) / 2 : G[p] / 2;
      let take = null;
      for (let d = 0; !take && d <= G[p]; d++) take = subsetSum(qs.map((q) => Lq[q]), want + d, rnd) || subsetSum(qs.map((q) => Lq[q]), want - d, rnd);
      const b = p % n;
      qs.forEach((q, j) => (host[q] = (take[j] ? a : b) === A[q] ? 0 : 1));
    }
    // 球団ごとの並び (決まった試合と対戦): Q = 対戦の番号 (決まった試合は -1)、F = 決まった側、L = 試合数
    const seq = [];
    for (let x = 0; x < n; x++) seq.push({ Q: [], F: [], L: [] });
    const add = (x, q, f, l) => {
      if (!l) return;
      seq[x].Q.push(q);
      seq[x].F.push(f);
      seq[x].L.push(l);
    };
    for (let k = 0; k <= N; k++) {
      for (const ev of E[k] || []) for (let x = 0; x < n; x++) add(x, -1, ev.side[x], ev.le);
      if (k < N)
        for (let i = 0; i < m; i++) {
          const q = k * m + i;
          add(A[q], q, 0, Lq[q]);
          add(B[q], q, 0, Lq[q]);
        }
    }
    // 球団ごとの評価: hard = 9 試合を超えた分 + 開幕からのロードの超過、soft = 形の好み (1 カードだけ・4 カード以上・開幕から 3 カードのロード)
    const HW = 20;
    const RUN = S.RUN_MAX;
    const OPEN = S.OPEN_AWAY;
    let hardOut = 0;
    function cost(x) {
      const Q = seq[x].Q;
      const F = seq[x].F;
      const L = seq[x].L;
      const len = Q.length;
      let hard = 0;
      let soft = 0;
      let side = -1;
      let g = 0;
      let c = 0;
      let first = true;
      for (let t = 0; t <= len; t++) {
        const q = Q[t];
        const s = t === len ? -2 : q < 0 ? F[t] : (host[q] ? B[q] : A[q]) === x ? 1 : 0;
        if (s === side) {
          g += L[t];
          c++;
          continue;
        }
        if (side >= 0) {
          // 1 つの連続の終わり
          if (g > RUN) hard += g - RUN;
          if (first && side === 0 && c > OPEN) hard += c - OPEN;
          if (first && side === 0 && c >= OPEN) soft += 3;
          if (c >= 4) soft += 2 * (c - 3);
          else if (c === 1 && !first && t < len) soft += 1;
          first = false;
        }
        side = s;
        g = L[t];
        c = 1;
      }
      hardOut = hard;
      return hard * HW + soft;
    }
    const tc = [];
    const th = [];
    for (let x = 0; x < n; x++) {
      tc[x] = cost(x);
      th[x] = hardOut;
    }
    let total = tc.reduce((s, v) => s + v, 0);
    let hard = th.reduce((s, v) => s + v, 0);
    let best = hard === 0 ? host.slice() : null;
    let bestCost = hard === 0 ? total : Infinity;
    // 入れ替えられる組 (同じ試合数のカードが 2 つ以上ある組)
    const movable = plist.filter((p) => meets[p].length > 1);
    // 9 試合以内にできないときは温度を戻してやり直す (最大 4 回)。それでも駄目なら一番ましな並び
    let any = host.slice();
    let anyCost = total;
    const cool = Math.pow(0.05 / 2, 1 / Math.max(1, iters));
    const cand = [];
    for (let it = 0, temp = 2; it < iters * 4 && movable.length && !(best && it >= iters); it++, temp = it % iters ? temp * cool : 2) {
      // 9 試合を超える球団があるときは、半分はその球団の組から選ぶ
      let p = movable[Math.floor(rnd() * movable.length)];
      if (hard > 0 && rnd() < 0.5) {
        let x = Math.floor(rnd() * n);
        while (!th[x]) x = (x + 1) % n;
        const y = (x + 1 + Math.floor(rnd() * (n - 1))) % n;
        const p2 = Math.min(x, y) * n + Math.max(x, y);
        if (meets[p2] && meets[p2].length > 1) p = p2;
      }
      const qs = meets[p];
      cand.length = 0;
      const mv = rnd();
      if (mv < 0.03 && G[p] % 2 === 0) {
        // 組の主催をそっくり入れ替える (試合数が偶数の組)
        for (const q of qs) cand.push(q);
      } else if (mv < 0.15) {
        // 主催側の 1〜2 カードと相手側の 1〜2 カードを、試合数の合計が同じなら入れ替える
        // (ストライキで 1 試合だけ残ったカード {1, 3} ⇔ {2, 2} のように、主催の組み合わせも変えられる)
        const a = Math.floor(p / n);
        const X = qs.filter((q) => (host[q] ? B[q] : A[q]) === a);
        const Y = qs.filter((q) => (host[q] ? B[q] : A[q]) !== a);
        if (!X.length || !Y.length) continue;
        const pick = U.shuffle(X.slice(), rnd).slice(0, 1 + Math.floor(rnd() * Math.min(2, X.length)));
        const sum = pick.reduce((t, q) => t + Lq[q], 0);
        const opts = [];
        Y.forEach((q, i) => {
          if (Lq[q] === sum) opts.push([q]);
          for (let j = i + 1; j < Y.length; j++) if (Lq[q] + Lq[Y[j]] === sum) opts.push([q, Y[j]]);
        });
        if (!opts.length) continue;
        cand.push(...pick, ...opts[Math.floor(rnd() * opts.length)]);
      } else {
        // 同じ試合数で主催が逆の 2 カードを入れ替える
        const u = qs[Math.floor(rnd() * qs.length)];
        const hu = host[u] ? B[u] : A[u];
        for (let j = 0; j < qs.length; j++) {
          const q = qs[j];
          if (Lq[q] === Lq[u] && (host[q] ? B[q] : A[q]) !== hu) cand.push(q);
        }
        if (!cand.length) continue;
        const v = cand[Math.floor(rnd() * cand.length)];
        cand.length = 0;
        cand.push(u, v);
      }
      for (const q of cand) host[q] ^= 1;
      const a = Math.floor(p / n);
      const b = p % n;
      const ca = cost(a);
      const ha = hardOut;
      const cb = cost(b);
      const hb = hardOut;
      const d = ca + cb - tc[a] - tc[b];
      if (d <= 0 || rnd() < Math.exp(-d / temp)) {
        hard += ha + hb - th[a] - th[b];
        tc[a] = ca;
        tc[b] = cb;
        th[a] = ha;
        th[b] = hb;
        total += d;
        if (hard === 0 && total < bestCost) {
          bestCost = total;
          best = host.slice();
          S._bestIt = it; // DEBUG
        }
        if (!best && total < anyCost) {
          anyCost = total;
          any = host.slice();
        }
      } else for (const q of cand) host[q] ^= 1;
    }
    (S._dbg = S._dbg || []).push([N, Math.round(bestCost), S._bestIt, hard]); // DEBUG
    if (!best) best = any;
    const out = [];
    for (let k = 0; k < N; k++) {
      let o = 0;
      for (let i = 0; i < m; i++) if (best[k * m + i]) o |= 1 << i;
      out.push(o);
    }
    return out;
  }

  /* 日程を作る
   * opts = { len: s10|s20|s30|half|full, strike, il, seed }
   * byLg = { C: [球団ID...], P: [...] }
   * 返り値 { days: [[{home, away, il?}]], dates: [2004 年の通し日], regDays }
   * ストライキの有無で変わるのは主催だけ (同じ seed なら対戦の並びは同じ)。中止の 2 日を除いて主催が半々になるようにする */
  S.build = function (opts, byLg) {
    const o = Object.assign({ len: "s20", strike: false, il: false, seed: 1 }, opts || {});
    const seed = o.seed || 1;
    const rng = U.seeded(seed);
    const shuffle = (arr) => U.shuffle(arr, rng.next);
    const full = o.len === "full";
    const il = full && !!o.il;
    const short = S.isShort(o.len);
    const strike = full && !!o.strike;
    const lgs = Object.keys(byLg).filter((k) => byLg[k].length >= 2 && byLg[k].length % 2 === 0);
    const byDate = {};
    const put = (n, m) => (byDate[n] || (byDate[n] = [])).push(m);
    // 交流戦 (後年ルール): 5 月中旬から 12 ブロック (両リーグ共通)
    const ilBlocks = new Set();
    let ilRounds = [];
    if (il && lgs.length === 2 && byLg[lgs[0]].length === byLg[lgs[1]].length) {
      const A = shuffle(byLg.C ? byLg.C.slice() : byLg[lgs[0]].slice());
      const B = shuffle(byLg.P ? byLg.P.slice() : byLg[lgs[1]].slice());
      if (A.length % 2 === 0) {
        const all = blocksFrom(S.IL_START, S.IL_START + 70, inAllStar).filter((b) => b.days.length === 3);
        const use = all.slice(0, A.length * 2);
        for (const b of use) ilBlocks.add(b.key);
        const games = interleague(A, B);
        const at = assign(
          games.map(() => 3),
          use,
          new Set()
        );
        ilRounds = games.map((g, j) => ({ games: g, at: at[j] }));
        for (const r of ilRounds) for (const n of r.at) for (const m of r.games) put(n, Object.assign({}, m));
      }
    }
    lgs.forEach((lg, li) => {
      const ids = shuffle(byLg[lg].slice());
      const n = ids.length;
      const idx = {};
      ids.forEach((id, i) => (idx[id] = i));
      const start = short ? S.OPEN.C : S.OPEN[lg] != null ? S.OPEN[lg] : S.OPEN.C;
      const end = full ? S.END[lg] || S.END.C : start + 400;
      const skip = (d) => inAllStar(d) || d < start;
      const blocks = blocksFrom(start, Math.max(end, start + 30), skip).filter((b) => !ilBlocks.has(b.key));
      const raw = S.cards(perPairOf(o, lg)).map((c) => c.L);
      const cap0 = blocks.length ? blocks[0].days.length : 3;
      // 巡の長さの並び → 回ごとの長さ・休みのブロック・日付
      const layout = (avoid) => {
        const Ls = cycleOrder(raw, cap0, avoid);
        const slotL = [];
        for (const L of Ls) for (let r = 0; r < n - 1; r++) slotL.push(L);
        const bl = blocks.slice();
        // フル: 最終日の目安までに余るブロックを休みとして均等に散らす (開幕直後とストライキの週末は除く)
        const off = new Set();
        if (full) {
          const extra =
            bl.length -
            blocksNeeded(
              slotL,
              bl.map((b) => b.days.length)
            );
          if (extra > 0) {
            const cand = [];
            bl.forEach((b, i) => {
              if (i < 2) return;
              if (b.days.some((d) => d >= S.STRIKE[0] - 1 && d <= S.STRIKE[1])) return;
              cand.push(i);
            });
            for (let j = 0; j < extra && j < cand.length; j++) off.add(cand[Math.min(cand.length - 1, Math.floor(((j + 0.5) * cand.length) / extra))]);
          }
        }
        return { Ls, slotL, at: assign(slotL, bl, off) };
      };
      let lay = layout(new Set());
      // 交流戦の直前・直後の巡は 3 連戦に (2 連戦だと主催の組み合わせが決まってしまい、交流戦の前後で連続が長くなりやすい)
      if (ilRounds.length) {
        const i0 = lay.at.findIndex((d) => d.length && d[0] > ilRounds[0].at[0]);
        if (i0 > 0) {
          const avoid = new Set([Math.floor((i0 - 1) / (n - 1)), Math.floor(i0 / (n - 1))]);
          if ([...avoid].some((c) => lay.Ls[c] < Math.max(...raw))) lay = layout(avoid);
        }
      }
      const { Ls, slotL, at } = lay;
      const N = slotL.length;
      // 交流戦の回を日付順に差し込む位置 (E[i] = 回 i の前)
      const leOf = (dates, st) => dates.filter((d) => !(st && inStrike(d))).length;
      const evAt = (st) => {
        const E = [];
        for (let i = 0; i <= N; i++) E.push([]);
        for (const r of ilRounds) {
          if (!r.at.length) continue;
          let i = at.findIndex((d) => d.length && d[0] > r.at[0]);
          if (i < 0) i = N;
          const side = new Array(n).fill(0);
          for (const m of r.games) if (idx[m.home] != null) side[idx[m.home]] = 1;
          E[i].push({ side, le: leOf(r.at, st) });
        }
        return E;
      };
      // 対戦の並び (ストライキの有無に関係なく同じ乱数で作るので、同じ seed なら同じ並び) と主催
      const seq = pairingSeq(
        ids.map((x, i) => i),
        Ls.length,
        rng.next
      );
      const slots = seq.map((pairs, k) => ({ pairs, le: leOf(at[k], strike) }));
      const pick = orient(n, slots, evAt(strike), U.seeded((seed * 7919 + li * 104729 + 1) >>> 0 || 1).next, 60 * N);
      seq.forEach((pairs, k) =>
        pairs.forEach(([a, b], i) => {
          const h = (pick[k] >> i) & 1 ? b : a;
          const v = h === a ? b : a;
          for (const d of at[k]) put(d, { home: ids[h], away: ids[v] });
        })
      );
    });
    // 日付ごとにまとめる (どのリーグも試合のない日は入れない)
    let dates = Object.keys(byDate)
      .map(Number)
      .sort((a, b) => a - b);
    // 9 月の選手会ストライキ (史実): その 2 日の試合は中止 (振替なし)
    if (strike) dates = dates.filter((d) => !inStrike(d));
    const days = dates.map((d) => byDate[d]);
    return { days, dates, regDays: days.length };
  };

  // 球団ごとの試合数 (日程から数える)
  S.countGames = function (days) {
    const c = {};
    for (const day of days)
      for (const m of day) {
        c[m.home] = (c[m.home] || 0) + 1;
        c[m.away] = (c[m.away] || 0) + 1;
      }
    return c;
  };

  PB.PenSched = S;
})((window.PB = window.PB || {}));
