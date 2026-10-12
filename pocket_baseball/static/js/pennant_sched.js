/* 熱闘！ポケットベースボール — ペナントの日程と日付 (2004 年の暦)
 * 日付は 2004 年の通し日 (1/1 = 0) で持つ。曜日・休日の並び (月曜休み・火〜木と金〜日の 3 連戦・
 * オールスター休み) だけ 2004 年風にした「架空の日程」で、実際の対戦カード・日付は再現しない。
 * セ・パはリーグごとに別々に並べるので、片方のリーグだけ試合がある日・休みの球団がある日もある。 */
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

  // 総当たりの組 (円形方式)。主催の偏りが出ないよう回ごとに入れ替える
  function roundRobin(ids) {
    const arr = ids.slice();
    const n = arr.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const day = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        day.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
      }
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

  // 連戦の並び (rounds) をブロックに詰める。fs (週末) で余るときは後ろ (土日) に寄せる
  function place(rounds, blocks, offSet) {
    const byDate = {};
    let bi = 0;
    let ri = 0;
    while (ri < rounds.length) {
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
      while (ri < rounds.length && used + rounds[ri].L <= cap) {
        take.push(rounds[ri]);
        used += rounds[ri].L;
        ri++;
      }
      if (!take.length) {
        // このブロックには入らない (開幕直後の 2 日だけのブロックなど)
        bi++;
        continue;
      }
      const days = b.kind === "fs" ? b.days.slice(cap - used) : b.days.slice(0, used);
      let k = 0;
      for (const r of take)
        for (let g = 0; g < r.L; g++) {
          const n = days[k++];
          (byDate[n] || (byDate[n] = [])).push(...r.games(g));
        }
      bi++;
    }
    return byDate;
  }

  // 詰めるのに要るブロック数
  function blocksNeeded(rounds, caps) {
    let n = 0;
    let ri = 0;
    let bi = 0;
    while (ri < rounds.length) {
      const cap = caps[Math.min(bi, caps.length - 1)] || 3;
      let used = 0;
      let any = false;
      while (ri < rounds.length && used + rounds[ri].L <= cap) {
        used += rounds[ri].L;
        ri++;
        any = true;
      }
      bi++;
      if (any) n++;
      if (bi > 1000) break;
    }
    return n;
  }

  /* 日程を作る
   * opts = { len: s10|s20|s30|half|full, strike, il, seed }
   * byLg = { C: [球団ID...], P: [...] }
   * 返り値 { days: [[{home, away, il?}]], dates: [2004 年の通し日], regDays } */
  S.build = function (opts, byLg) {
    const o = Object.assign({ len: "s20", strike: false, il: false, seed: 1 }, opts || {});
    const rng = U.seeded(o.seed || 1);
    const shuffle = (arr) => U.shuffle(arr, rng.next);
    const full = o.len === "full";
    const il = full && !!o.il;
    const short = S.isShort(o.len);
    const lgs = Object.keys(byLg).filter((k) => byLg[k].length >= 2 && byLg[k].length % 2 === 0);
    // 交流戦 (後年ルール): 5 月中旬から 12 ブロック (両リーグ共通)
    const ilBlocks = new Set();
    let ilDates = {};
    if (il && lgs.length === 2 && byLg[lgs[0]].length === byLg[lgs[1]].length) {
      const all = blocksFrom(S.IL_START, S.IL_START + 70, inAllStar).filter((b) => b.days.length === 3);
      const use = all.slice(0, 12);
      for (const b of use) ilBlocks.add(b.key);
      const A = shuffle(byLg.C ? byLg.C.slice() : byLg[lgs[0]].slice());
      const B = shuffle(byLg.P ? byLg.P.slice() : byLg[lgs[1]].slice());
      const n = A.length;
      const rounds = [];
      for (const swap of [false, true])
        for (let r = 0; r < n; r++) {
          const pairs = A.map((a, i) => {
            const b = B[(i + r) % n];
            const aHome = ((i + r) % 2 === 0) !== swap;
            return aHome ? { home: a, away: b, il: 1 } : { home: b, away: a, il: 1 };
          });
          rounds.push({ L: 3, games: () => pairs.map((m) => Object.assign({}, m)) });
        }
      ilDates = place(rounds, use, new Set());
    }
    const perLg = {};
    for (const lg of lgs) {
      const ids = shuffle(byLg[lg].slice());
      const rr = roundRobin(ids);
      let cards = S.cards(perPairOf(o, lg));
      const start = short ? S.OPEN.C : S.OPEN[lg] != null ? S.OPEN[lg] : S.OPEN.C;
      const end = full ? S.END[lg] || S.END.C : start + 400;
      const skip = (n) => inAllStar(n) || n < start;
      let blocks = blocksFrom(start, Math.max(end, start + 30), skip).filter((b) => !ilBlocks.has(b.key));
      // 開幕のブロックが短い (土曜開幕など) ときは、入るカードを先頭に
      const cap0 = blocks.length ? blocks[0].days.length : 3;
      if (cards[0].L > cap0) {
        const k = cards.findIndex((c) => c.L <= cap0);
        if (k > 0) cards = [cards[k]].concat(cards.slice(0, k), cards.slice(k + 1));
      }
      const rounds = [];
      for (const c of cards) {
        const order = shuffle([...Array(rr.length).keys()]);
        for (const r of order) {
          const pairs = rr[r].map(([a, b]) => (c.A ? { home: a, away: b } : { home: b, away: a }));
          rounds.push({ L: c.L, games: () => pairs.map((m) => Object.assign({}, m)) });
        }
      }
      // フル: 最終日の目安までに余るブロックを休みとして均等に散らす (開幕直後とストライキの週末は除く)
      const off = new Set();
      if (full) {
        const need = blocksNeeded(
          rounds,
          blocks.map((b) => b.days.length)
        );
        const extra = blocks.length - need;
        if (extra > 0) {
          const cand = [];
          blocks.forEach((b, i) => {
            if (i < 2) return;
            if (b.days.some((n) => n >= S.STRIKE[0] - 1 && n <= S.STRIKE[1])) return;
            cand.push(i);
          });
          for (let j = 0; j < extra && j < cand.length; j++) off.add(cand[Math.min(cand.length - 1, Math.floor(((j + 0.5) * cand.length) / extra))]);
        }
      }
      perLg[lg] = place(rounds, blocks, off);
    }
    // 両リーグと交流戦を日付ごとにまとめる (どのリーグも試合のない日は入れない)
    const all = {};
    for (const src of [ilDates].concat(lgs.map((k) => perLg[k])))
      for (const n in src) (all[n] || (all[n] = [])).push(...src[n]);
    let dates = Object.keys(all)
      .map(Number)
      .sort((a, b) => a - b);
    // 9 月の選手会ストライキ (史実): その 2 日の試合は中止 (振替なし)
    if (o.strike && full) dates = dates.filter((n) => n < S.STRIKE[0] || n > S.STRIKE[1]);
    const days = dates.map((n) => all[n]);
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
