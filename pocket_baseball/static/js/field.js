/* 熱闘！ポケットベースボール — 球場の座標系と打球の物理
 * 座標: 本塁=原点, +y=センター方向, +x=一塁(ライト)側, +z=上 (単位 m) */
(function (PB) {
  "use strict";
  const U = PB.U;
  const F = {};

  F.BASE_DIST = 27.431;
  const H = F.BASE_DIST / Math.SQRT2;
  F.BASES = [
    [0, 0],
    [H, H],
    [0, 2 * H],
    [-H, H],
    [0, 0],
  ];
  F.base = (i) => F.BASES[i];
  F.MOUND = [0, 18.44];
  F.FENCE_H = 3.4;
  F.GRAVITY = 9.8;
  F.DRAG = 0.0038;
  F.FOUL_ANGLE = Math.PI / 4;
  F.POS_NAME = { P: "ピッチャー", C: "キャッチャー", "1B": "ファースト", "2B": "セカンド", "3B": "サード", SS: "ショート", LF: "レフト", CF: "センター", RF: "ライト" };

  // センター方向からの角度 (+がライト側)
  F.angle = (x, y) => Math.atan2(x, y);
  // フェンスまでの距離 (両翼100m・中堅122m)
  F.fenceDist = (theta) => 100 + 22 * Math.cos(2 * U.clamp(theta, -F.FOUL_ANGLE, F.FOUL_ANGLE));
  F.isFairAngle = (theta) => Math.abs(theta) <= F.FOUL_ANGLE + 1e-6;
  /* 内野の形 (3D 球場の地面シェーダーと同じ定義)
   * a = 本塁→一塁 方向の座標, b = 本塁→三塁 方向の座標。
   * 内野の芝は a,b < GRASS_EDGE の正方形、その外側から マウンド中心 R=29m の円弧までが土。 */
  F.SHAPE = { GRASS_EDGE: 26.1, ARC_R: 29, MOUND_C: [0, 17.98], MOUND_R: 2.75, HOME_R: 4.2, CUT_R: 2.4 };
  F.isDirt = function (x, y) {
    const S = F.SHAPE;
    const r = Math.hypot(x, y);
    if (r < S.HOME_R) return true;
    if (Math.hypot(x - S.MOUND_C[0], y - S.MOUND_C[1]) < S.MOUND_R) return true;
    for (let i = 1; i <= 3; i++) if (Math.hypot(x - F.BASES[i][0], y - F.BASES[i][1]) < S.CUT_R) return true;
    const a = (y + x) * Math.SQRT1_2;
    const b = (y - x) * Math.SQRT1_2;
    if (a < -1 || b < -1) return false;
    return Math.max(a, b) > S.GRASS_EDGE && Math.hypot(x, y - F.MOUND[1]) < S.ARC_R;
  };

  /* 打球 (位置 p, 速度 v) を時間 dt だけ進める。b はミュータブル。
   * b = {x,y,z,vx,vy,vz,air,bounces,hr,dead} */
  F.stepBall = function (b, dt) {
    if (b.dead) return;
    if (b.air) {
      const s = Math.hypot(b.vx, b.vy, b.vz);
      const k = F.DRAG * s;
      b.vx += -k * b.vx * dt;
      b.vy += -k * b.vy * dt;
      b.vz += (-F.GRAVITY - k * b.vz) * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
    } else {
      const s = Math.hypot(b.vx, b.vy);
      if (s < 0.35) {
        b.vx = b.vy = 0;
        b.stopped = true;
      } else {
        const dirt = F.isDirt(b.x, b.y);
        const dec = (dirt ? 1.6 : 2.2) + 0.07 * s;
        const ns = Math.max(0, s - dec * dt);
        b.vx *= ns / s;
        b.vy *= ns / s;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
    }
    // フェンス
    const r = Math.hypot(b.x, b.y);
    const th = F.angle(b.x, b.y);
    if (F.isFairAngle(th) && !b.hr) {
      const fd = F.fenceDist(th);
      if (r >= fd) {
        if (b.air && b.bounces === 0 && b.z > F.FENCE_H && !b.fenceHit) {
          b.hr = true;
        } else if (!b.hr) {
          // フェンス直撃 → 跳ね返り
          const nx = b.x / r;
          const ny = b.y / r;
          const vn = b.vx * nx + b.vy * ny;
          if (vn > 0) {
            b.vx -= 1.55 * vn * nx;
            b.vy -= 1.55 * vn * ny;
            b.vx *= 0.7;
            b.vy *= 0.7;
          }
          b.x = nx * (fd - 0.2);
          b.y = ny * (fd - 0.2);
          b.fenceHit = true;
        }
      }
    }
    if (b.hr && r > F.fenceDist(th) + 25) {
      b.dead = true;
      return;
    }
    // 地面
    if (b.air && b.z <= 0) {
      b.z = 0;
      if (b.hr) {
        b.dead = true;
        return;
      }
      if (b.bounces === 0) {
        b.landX = b.x;
        b.landY = b.y;
      }
      b.bounces++;
      const dirt = F.isDirt(b.x, b.y);
      if (Math.abs(b.vz) > 1.6) {
        const e = dirt ? 0.48 : 0.4;
        const hs = Math.hypot(b.vx, b.vy) || 1;
        const f = Math.max(0.55, 1 - ((dirt ? 0.28 : 0.38) * (1 + e) * Math.abs(b.vz)) / hs);
        b.vz = -b.vz * e;
        b.vx *= f;
        b.vy *= f;
      } else {
        b.vz = 0;
        b.air = false;
      }
    }
    // ファウルゾーンの壁 (観客席) — ファウルラインから 20m 程度
    if (!F.isFairAngle(th) && !b.hr) {
      const off = Math.abs(Math.sin(Math.abs(th) - F.FOUL_ANGLE)) * r;
      if (off > 19 || (Math.abs(th) > Math.PI / 2 && r > 17)) b.dead = true;
    }
  };

  F.newBall = function (p, v) {
    return { x: p[0], y: p[1], z: p[2], vx: v[0], vy: v[1], vz: v[2], air: p[2] > 0.01 || v[2] > 0, bounces: 0, hr: false, dead: false, stopped: false };
  };

  /* 打球軌道の予測 (固定 dt で記録)
   * 返り値 samples[i] = {t,x,y,z,air,hr} と付帯情報 */
  F.PRED_DT = 1 / 60;
  F.predict = function (ball, t0, maxT) {
    const b = Object.assign({}, ball);
    const out = [];
    const dt = F.PRED_DT;
    let t = t0;
    const end = t0 + (maxT || 14);
    out.push({ t, x: b.x, y: b.y, z: b.z, air: b.air && b.bounces === 0, hr: b.hr, vx: b.vx, vy: b.vy, vz: b.vz, onAir: b.air });
    while (t < end && !b.dead && !b.stopped) {
      F.stepBall(b, dt);
      t += dt;
      out.push({ t, x: b.x, y: b.y, z: b.z, air: b.air && b.bounces === 0, hr: b.hr, vx: b.vx, vy: b.vy, vz: b.vz, onAir: b.air });
    }
    const info = { hr: b.hr, landX: b.landX, landY: b.landY, dead: b.dead, fenceHit: !!b.fenceHit };
    return { samples: out, info, end: b };
  };

  // サンプル列から時刻 t の位置を補間
  F.sampleAt = function (pred, t) {
    const s = pred.samples;
    if (t <= s[0].t) return s[0];
    const i = Math.floor((t - s[0].t) / F.PRED_DT);
    if (i >= s.length - 1) return s[s.length - 1];
    const a = s[i];
    const c = s[i + 1];
    const f = (t - a.t) / (c.t - a.t);
    return { t, x: U.lerp(a.x, c.x, f), y: U.lerp(a.y, c.y, f), z: U.lerp(a.z, c.z, f), air: a.air, hr: c.hr, vx: a.vx, vy: a.vy, vz: a.vz, onAir: a.onAir };
  };

  // フェンスを無視して地面に落ちるまでの水平距離 (飛距離表示用)
  F.carry = function (p, v) {
    let x = p[0];
    let y = p[1];
    let z = p[2];
    let vx = v[0];
    let vy = v[1];
    let vz = v[2];
    const dt = 1 / 120;
    for (let i = 0; i < 2400; i++) {
      const s = Math.hypot(vx, vy, vz);
      const k = F.DRAG * s;
      vx += -k * vx * dt;
      vy += -k * vy * dt;
      vz += (-F.GRAVITY - k * vz) * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      if (z <= 0) break;
    }
    return Math.hypot(x, y);
  };

  F.distToBase = (x, y, b) => Math.hypot(x - F.BASES[b][0], y - F.BASES[b][1]);

  PB.F = F;
})((window.PB = window.PB || {}));
