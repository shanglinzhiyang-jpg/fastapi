/* 熱闘！ポケットベースボール — 2頭身キャラクターの描画
 * 大きな丸い頭・手足は浮いたグローブとスパイク、というデフォルメ体型。 */
(function (PB) {
  "use strict";

  const C = {};

  function shade(hex, amt) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt)));
    g = Math.max(0, Math.min(255, Math.round(g + amt)));
    b = Math.max(0, Math.min(255, Math.round(b + amt)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  C.shade = shade;

  function ellipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
  }

  /* o: {
   *   team:{main,sub,cap}, face:{skin,eyes,brow,cheek}, num,
   *   view:'front'|'back'|'left'|'right',
   *   pose:'stand'|'run'|'bat'|'swing'|'bunt'|'windup'|'throw'|'catch'|'dive'|'crouch'|'ready'|'cheer',
   *   t: アニメーション進行 (0..1 か秒), phase: 走りの位相, glove:'L'|'R', ball:bool, alpha
   * }
   * (x, y): 足元の画面座標, s: 1m あたりのピクセル数 */
  C.draw = function (ctx, x, y, s, o) {
    const team = o.team || { main: "#888", sub: "#fff", cap: "#333" };
    const face = o.face || { skin: "#ffd9b8", eyes: "round", brow: 0 };
    const view = o.view || "front";
    const pose = o.pose || "stand";
    const tiny = s < 9;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.translate(x, y);
    if (pose === "dive") {
      ctx.translate(0, -0.25 * s);
      ctx.rotate((o.dir || 1) * 1.2);
    }
    const flip = view === "left" ? -1 : 1;
    // 影
    if (!o.noShadow) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ellipse(ctx, 0, 0, 0.42 * s, 0.13 * s);
      ctx.fill();
    }
    let bob = 0;
    let footA = 0;
    let footB = 0;
    let lift = 0;
    if (pose === "run") {
      const ph = o.phase || 0;
      bob = Math.abs(Math.sin(ph)) * 0.07;
      footA = Math.sin(ph) * 0.2;
      footB = -footA;
    }
    if (pose === "windup") {
      const t = o.t || 0;
      if (t > 0.25 && t < 0.7) lift = Math.sin(((t - 0.25) / 0.45) * Math.PI) * 0.35;
    }
    if (pose === "crouch") bob = -0.25;
    const yb = -bob * s;
    const capC = team.cap;
    const body = team.main;
    const sub = team.sub;
    // 足 (スパイク)
    ctx.fillStyle = "#222630";
    const fy = 0;
    if (view === "left" || view === "right") {
      ellipse(ctx, (footA * flip + 0.05 * flip) * s, fy - Math.max(0, footA) * 0.15 * s, 0.17 * s, 0.08 * s);
      ctx.fill();
      ellipse(ctx, (footB * flip - 0.05 * flip) * s, fy - Math.max(0, footB) * 0.15 * s - lift * s, 0.17 * s, 0.08 * s);
      ctx.fill();
    } else {
      ellipse(ctx, -0.16 * s, fy - Math.max(0, footA) * 0.12 * s, 0.12 * s, 0.08 * s);
      ctx.fill();
      ellipse(ctx, 0.16 * s, fy - Math.max(0, footB) * 0.12 * s - lift * s, 0.12 * s, 0.08 * s);
      ctx.fill();
    }
    // 胴体
    const bh = 0.6;
    const bw = 0.52;
    const by = -0.42 + bob * 0.5;
    ctx.fillStyle = body;
    ctx.beginPath();
    const rx = (bw / 2) * s;
    const top = (by - bh / 2) * s - lift * 0.3 * s + yb;
    const bot = (by + bh / 2) * s + yb;
    ctx.moveTo(-rx, top + rx * 0.6);
    ctx.quadraticCurveTo(-rx, top, 0, top);
    ctx.quadraticCurveTo(rx, top, rx, top + rx * 0.6);
    ctx.lineTo(rx * 0.92, bot);
    ctx.quadraticCurveTo(0, bot + 0.06 * s, -rx * 0.92, bot);
    ctx.closePath();
    ctx.fill();
    if (!tiny) {
      // ベルト・ライン
      ctx.fillStyle = shade(body, -55);
      ctx.fillRect(-rx * 0.92, bot - 0.1 * s, rx * 1.84, 0.06 * s);
      ctx.strokeStyle = sub;
      ctx.lineWidth = Math.max(1, 0.035 * s);
      if (view === "front") {
        ctx.beginPath();
        ctx.moveTo(0, top + 0.05 * s);
        ctx.lineTo(0, bot - 0.12 * s);
        ctx.stroke();
      }
      if (view === "back" && o.num != null && s > 14) {
        ctx.fillStyle = sub;
        ctx.font = "800 " + Math.round(0.3 * s) + "px 'Dela Gothic One', 'M PLUS Rounded 1c', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(o.num), 0, (top + bot) / 2 - 0.02 * s);
      }
    }
    // 頭
    const hr = 0.34;
    const hy = -1.14 - lift * 0.4 + bob * 0.3;
    const hx = 0;
    const HY = hy * s + yb;
    ctx.fillStyle = face.skin;
    ellipse(ctx, hx, HY, hr * s, hr * s * 0.96);
    ctx.fill();
    // 帽子
    ctx.fillStyle = capC;
    ctx.beginPath();
    ctx.ellipse(hx, HY - 0.02 * s, hr * s * 1.02, hr * s * 0.86, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    if (view === "front") {
      ctx.fillStyle = shade(capC, -25);
      ellipse(ctx, hx, HY - 0.02 * s, hr * s * 0.98, 0.07 * s);
      ctx.fill();
      if (!tiny) {
        ctx.fillStyle = sub;
        ctx.font = "800 " + Math.round(0.2 * s) + "px 'Dela Gothic One', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.mark || "", hx, HY - 0.17 * s);
      }
    } else if (view === "left" || view === "right") {
      ctx.fillStyle = shade(capC, -25);
      ellipse(ctx, hx + flip * 0.3 * s, HY - 0.03 * s, 0.2 * s, 0.05 * s);
      ctx.fill();
    } else {
      // 後ろ姿: 帽子のアジャスター
      ctx.fillStyle = shade(capC, 25);
      ctx.fillRect(hx - 0.06 * s, HY - 0.05 * s, 0.12 * s, 0.04 * s);
    }
    // 顔
    if (!tiny && (view === "front" || view === "left" || view === "right")) {
      const ex = view === "front" ? 0.12 : 0.12;
      const ox = view === "front" ? 0 : flip * 0.13;
      const ey = HY + 0.07 * s;
      const eyes = face.eyes;
      ctx.fillStyle = "#1b1b22";
      ctx.strokeStyle = "#1b1b22";
      ctx.lineWidth = Math.max(1, 0.035 * s);
      const drawEye = (cx) => {
        if (eyes === "smile") {
          ctx.beginPath();
          ctx.arc(cx, ey + 0.02 * s, 0.05 * s, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        } else if (eyes === "line") {
          ctx.beginPath();
          ctx.moveTo(cx - 0.05 * s, ey);
          ctx.lineTo(cx + 0.05 * s, ey);
          ctx.stroke();
        } else if (eyes === "sharp") {
          ellipse(ctx, cx, ey, 0.035 * s, 0.06 * s, 0.4 * (cx > ox ? -1 : 1));
          ctx.fill();
        } else {
          const big = eyes === "big" ? 1.25 : 1;
          ellipse(ctx, cx, ey, 0.04 * s * big, 0.07 * s * big);
          ctx.fill();
          if (s > 22) {
            ctx.fillStyle = "#fff";
            ellipse(ctx, cx + 0.012 * s, ey - 0.025 * s, 0.013 * s, 0.017 * s);
            ctx.fill();
            ctx.fillStyle = "#1b1b22";
          }
        }
      };
      if (view === "front") {
        drawEye(ox - ex);
        drawEye(ox + ex);
      } else {
        drawEye(ox + flip * 0.06 * s * 0);
      }
      if (eyes === "glasses" && view === "front") {
        ctx.strokeStyle = "#333";
        ctx.lineWidth = Math.max(1, 0.025 * s);
        ellipse(ctx, -ex, ey, 0.085 * s, 0.075 * s);
        ctx.stroke();
        ellipse(ctx, ex, ey, 0.085 * s, 0.075 * s);
        ctx.stroke();
      }
      if (face.brow && view === "front") {
        ctx.strokeStyle = "#2a1c12";
        ctx.lineWidth = Math.max(1, 0.03 * s * face.brow);
        ctx.beginPath();
        ctx.moveTo(-ex - 0.06 * s, ey - 0.12 * s);
        ctx.lineTo(-ex + 0.05 * s, ey - 0.1 * s);
        ctx.moveTo(ex + 0.06 * s, ey - 0.12 * s);
        ctx.lineTo(ex - 0.05 * s, ey - 0.1 * s);
        ctx.stroke();
      }
      if (face.cheek && view === "front" && s > 18) {
        ctx.fillStyle = "rgba(255,120,120,0.35)";
        ellipse(ctx, -0.2 * s, ey + 0.09 * s, 0.05 * s, 0.03 * s);
        ctx.fill();
        ellipse(ctx, 0.2 * s, ey + 0.09 * s, 0.05 * s, 0.03 * s);
        ctx.fill();
      }
    }
    // 手 (グローブ)
    const handY = (by - 0.02) * s + yb;
    const drawHand = (hx2, hy2, glove) => {
      ctx.fillStyle = glove ? "#9a5b2e" : face.skin;
      ellipse(ctx, hx2, hy2, (glove ? 0.13 : 0.095) * s, (glove ? 0.12 : 0.095) * s);
      ctx.fill();
      if (!tiny) {
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    const gl = o.glove !== false && !["bat", "swing", "bunt"].includes(pose);
    const t = o.t || 0;
    let L = [-0.4 * s, handY];
    let R = [0.4 * s, handY];
    if (pose === "run") {
      const ph = o.phase || 0;
      L = [-0.38 * s, handY - Math.sin(ph) * 0.12 * s];
      R = [0.38 * s, handY + Math.sin(ph) * 0.12 * s];
    } else if (pose === "catch") {
      L = [-0.3 * s, (hy - 0.1) * s + yb];
      R = [0.3 * s, handY - 0.15 * s];
    } else if (pose === "ready") {
      L = [-0.32 * s, handY + 0.12 * s];
      R = [0.32 * s, handY + 0.12 * s];
    } else if (pose === "throw") {
      const k = Math.min(1, t * 3);
      R = [(0.45 - k * 0.8) * s * flip, (hy - 0.15 + k * 0.6) * s + yb];
      L = [-0.4 * s * flip, handY - 0.1 * s];
    } else if (pose === "cheer") {
      L = [-0.42 * s, (hy - 0.25) * s + yb];
      R = [0.42 * s, (hy - 0.25) * s + yb];
    } else if (pose === "windup") {
      // 0..0.25 セット, 0.25..0.7 足上げ, 0.7..0.85 踏み込み, 0.85 リリース, その後フォロー
      if (t < 0.3) {
        L = [-0.08 * s, (by - 0.15) * s + yb];
        R = [0.08 * s, (by - 0.15) * s + yb];
      } else if (t < 0.72) {
        const k = (t - 0.3) / 0.42;
        L = [-0.1 * s, (by - 0.25 - k * 0.2) * s + yb];
        R = [(0.1 + k * 0.4) * s * (o.throwSide || 1), (by - 0.2 - k * 0.5) * s + yb];
      } else if (t < 0.88) {
        const k = (t - 0.72) / 0.16;
        L = [-0.45 * s * (o.throwSide || 1), handY - 0.1 * s];
        R = [(0.5 - k * 0.6) * s * (o.throwSide || 1), (hy - 0.35 + k * 0.4) * s + yb];
      } else {
        const k = Math.min(1, (t - 0.88) / 0.2);
        L = [-0.4 * s * (o.throwSide || 1), handY];
        R = [(-0.1 - k * 0.3) * s * (o.throwSide || 1), (by + 0.05 + k * 0.1) * s + yb];
      }
    } else if (pose === "crouch") {
      L = [-0.35 * s, handY - 0.05 * s];
      R = [0.3 * s, handY + 0.05 * s];
    }
    if (pose === "bat" || pose === "swing" || pose === "bunt") {
      C.drawBatter(ctx, s, o, by, hy, yb);
    } else {
      const gloveLeft = (o.glove || "L") === "L";
      drawHand(L[0], L[1], gl && gloveLeft);
      drawHand(R[0], R[1], gl && !gloveLeft);
      if (o.ball) {
        const bp = gloveLeft ? R : L;
        ctx.fillStyle = "#fff";
        ellipse(ctx, bp[0], bp[1] - 0.05 * s, Math.max(1.5, 0.08 * s), Math.max(1.5, 0.08 * s));
        ctx.fill();
        ctx.strokeStyle = "#d33a3a";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  /* バッター (後ろ姿・構え/スイング/バント)
   * o.side: 'R' (右打者 = 画面左に立つ) | 'L'
   * o.t: スイング進行 0..1 */
  C.drawBatter = function (ctx, s, o, by, hy, yb) {
    const side = o.side === "L" ? -1 : 1; // 右打者 +1
    const pose = o.pose;
    const t = o.t || 0;
    const sh = (by - 0.25) * s + yb; // 肩の高さ
    let hand;
    let ang;
    let len = 0.95 * s;
    if (pose === "bunt") {
      hand = [side * 0.1 * s, sh + 0.05 * s];
      ang = side > 0 ? 0 : Math.PI;
      len = 0.9 * s;
    } else if (pose === "swing") {
      // 構え(後ろ肩) → 前へ振り抜く
      const k = Math.min(1, t);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const a0 = -2.3;
      const a1 = 0.9;
      const a = a0 + (a1 - a0) * e;
      hand = [side * (-0.25 + e * 0.6) * s, sh + (0.05 + Math.sin(e * Math.PI) * 0.12) * s];
      ang = side > 0 ? a : Math.PI - a;
    } else {
      hand = [side * -0.28 * s, sh - 0.05 * s];
      ang = side > 0 ? -2.15 : Math.PI + 2.15;
    }
    // バット
    const bx = hand[0] + Math.cos(ang) * len;
    const byy = hand[1] + Math.sin(ang) * len;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#d9a55b";
    ctx.lineWidth = Math.max(2, 0.08 * s);
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.lineTo(bx, byy);
    ctx.stroke();
    ctx.strokeStyle = "#e9bd78";
    ctx.lineWidth = Math.max(1.5, 0.05 * s);
    ctx.beginPath();
    ctx.moveTo(hand[0] + Math.cos(ang) * len * 0.45, hand[1] + Math.sin(ang) * len * 0.45);
    ctx.lineTo(bx, byy);
    ctx.stroke();
    // 両手
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 0.1 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hand[0] + Math.cos(ang) * 0.12 * s, hand[1] + Math.sin(ang) * 0.12 * s, 0.095 * s, 0, Math.PI * 2);
    ctx.fill();
    void hy;
  };

  /* 顔アイコン (メニュー用) */
  C.portrait = function (canvas, p, team) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    C.draw(ctx, w / 2, h * 1.18, h * 0.62, { team, face: p.face, view: "front", pose: "stand", mark: team.mark, noShadow: true });
  };

  PB.Chara = C;
})((window.PB = window.PB || {}));
