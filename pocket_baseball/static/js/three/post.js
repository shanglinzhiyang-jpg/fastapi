/* 熱闘！ポケットベースボール — 画面の仕上げ (PB.Post)
 * シーンを HDR (半精度浮動小数・MSAA) の RenderTarget に描き、光のにじみ (dual filter bloom) を足して
 * ACES のトーンマップ・sRGB・テレビ中継風の色味・周辺減光・ディザで画面に出す。
 * 半精度の色バッファが使えない WebGL2 では、トーンマップ済みの 8bit で受けて色味と周辺減光だけ付ける。
 * WebGL1・フレームバッファが作れない端末では使わない (呼び出し側がそのまま画面に描く)。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const Post = {};
  PB.Post = Post;
  if (!T) return;

  const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  // 縮小 (最初の 1 回だけ明るい所を取り出す: Karis 平均でちらつきを抑える)
  const DOWN_FS = `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; uniform float uKnee; uniform float uFirst;
varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 pick(vec3 c){
  float l = max(c.r, max(c.g, c.b));
  float s = clamp(l - uThresh + uKnee, 0.0, 2.0 * uKnee);
  s = s * s / (4.0 * uKnee + 1e-4);
  return c * max(s, l - uThresh) / max(l, 1e-4);
}
void main(){
  vec2 o = uTexel;
  if (uFirst > 0.5) {
    // 4 タップ (双線形で 4x4 の箱) + Karis 平均
    vec3 a = texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
    vec3 b = texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb;
    vec3 c = texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb;
    vec3 d = texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
    a = pick(min(a, vec3(64.0))); b = pick(min(b, vec3(64.0))); c = pick(min(c, vec3(64.0))); d = pick(min(d, vec3(64.0)));
    float wa = 1.0 / (1.0 + lum(a)); float wb = 1.0 / (1.0 + lum(b)); float wc = 1.0 / (1.0 + lum(c)); float wd = 1.0 / (1.0 + lum(d));
    gl_FragColor = vec4((a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd), 1.0);
    return;
  }
  // 13 タップ (Jimenez 2014)
  vec3 A = texture2D(tSrc, vUv + o * vec2(-2.0, -2.0)).rgb;
  vec3 B = texture2D(tSrc, vUv + o * vec2(0.0, -2.0)).rgb;
  vec3 C = texture2D(tSrc, vUv + o * vec2(2.0, -2.0)).rgb;
  vec3 D = texture2D(tSrc, vUv + o * vec2(-1.0, -1.0)).rgb;
  vec3 E = texture2D(tSrc, vUv + o * vec2(1.0, -1.0)).rgb;
  vec3 F = texture2D(tSrc, vUv + o * vec2(-2.0, 0.0)).rgb;
  vec3 G = texture2D(tSrc, vUv).rgb;
  vec3 H = texture2D(tSrc, vUv + o * vec2(2.0, 0.0)).rgb;
  vec3 I = texture2D(tSrc, vUv + o * vec2(-1.0, 1.0)).rgb;
  vec3 J = texture2D(tSrc, vUv + o * vec2(1.0, 1.0)).rgb;
  vec3 K = texture2D(tSrc, vUv + o * vec2(-2.0, 2.0)).rgb;
  vec3 L = texture2D(tSrc, vUv + o * vec2(0.0, 2.0)).rgb;
  vec3 M = texture2D(tSrc, vUv + o * vec2(2.0, 2.0)).rgb;
  vec3 c = (D + E + I + J) * 0.125 + (A + C + K + M) * 0.03125 + (B + F + H + L) * 0.0625 + G * 0.125;
  gl_FragColor = vec4(c, 1.0);
}`;
  // 拡大 (9 タップのテント) して一段大きい mip に足す
  const UP_FS = `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uScatter;
varying vec2 vUv;
void main(){
  vec2 o = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += (texture2D(tSrc, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(o.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -o.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, o.y)).rgb) * 2.0;
  c += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb;
  gl_FragColor = vec4(c * (uScatter / 16.0), 1.0);
}`;
  // 仕上げ: bloom + 色味 → (HDR のときだけ) トーンマップと sRGB → 彩度・コントラスト・周辺減光・ディザ (+ MSAA が無いときは FXAA)
  const COMP_FS = `
uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform vec2 uRes; uniform vec2 uTexel;
uniform float uSat; uniform float uContrast; uniform float uVignette; uniform float uSplit; uniform float uLift;
varying vec2 vUv;
#ifdef PB_FXAA
float fl(vec3 c){
  #ifdef PB_HDR
  c = c / (1.0 + c);
  #endif
  return dot(c, vec3(0.299, 0.587, 0.114));
}
vec3 fxaa(vec2 uv){
  vec2 px = uTexel;
  vec3 cNW = texture2D(tScene, uv + vec2(-1.0, -1.0) * px).rgb;
  vec3 cNE = texture2D(tScene, uv + vec2(1.0, -1.0) * px).rgb;
  vec3 cSW = texture2D(tScene, uv + vec2(-1.0, 1.0) * px).rgb;
  vec3 cSE = texture2D(tScene, uv + vec2(1.0, 1.0) * px).rgb;
  vec3 cM = texture2D(tScene, uv).rgb;
  float lNW = fl(cNW); float lNE = fl(cNE); float lSW = fl(cSW); float lSE = fl(cSE); float lM = fl(cM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
  vec3 a = 0.5 * (texture2D(tScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tScene, uv - dir * 0.5).rgb + texture2D(tScene, uv + dir * 0.5).rgb);
  float lB = fl(b);
  return (lB < lMin || lB > lMax) ? a : b;
}
#endif
void main(){
  #ifdef PB_FXAA
  vec3 c = fxaa(vUv);
  #else
  vec3 c = texture2D(tScene, vUv).rgb;
  #endif
  #ifdef PB_BLOOM
  c += texture2D(tBloom, vUv).rgb * uBloom;
  #endif
  #ifdef PB_HDR
  // 影は少し青く、明るい所は少し暖かく (トーンマップ前の線形で)
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c *= mix(vec3(1.0), mix(vec3(0.965, 0.99, 1.055), vec3(1.035, 1.0, 0.955), smoothstep(0.04, 0.55, l)), uSplit);
  c += uLift * vec3(0.004, 0.005, 0.008);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 g = gl_FragColor.rgb;
  #else
  vec3 g = c;
  #endif
  float y = dot(g, vec3(0.299, 0.587, 0.114));
  g = mix(vec3(y), g, uSat);
  g = (g - 0.5) * uContrast + 0.5;
  vec2 d = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  g *= 1.0 - uVignette * smoothstep(0.3, 1.0, length(d));
  g += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;

  // 半精度浮動小数の色バッファに描けるか
  function canHalf(renderer) {
    const ex = renderer.extensions;
    return !!(ex.has("EXT_color_buffer_float") || ex.has("EXT_color_buffer_half_float"));
  }
  // その形式で使える MSAA のサンプル数 (want 以下で一番多いもの、無ければ 0)
  function pickSamples(gl, fmt, want) {
    if (!want) return 0;
    let list = null;
    try {
      list = gl.getInternalformatParameter(gl.RENDERBUFFER, fmt, gl.SAMPLES);
    } catch (e) {
      list = null;
    }
    if (!list || !list.length) return 0;
    const arr = Array.from(list).sort((a, b) => a - b);
    const le = arr.filter((s) => s <= want);
    return le.length ? le[le.length - 1] : Math.min(arr[0], 4);
  }

  /* quality: "mid" | "high"。opts.force: "ldr" | "fxaa" (確認用: 8bit の経路 / MSAA なしの経路) */
  Post.create = function (renderer, quality, opts) {
    opts = opts || {};
    const gl = renderer.getContext();
    const P = { ok: false, hdr: false, samples: 0, quality, failed: false };
    if (!renderer.capabilities.isWebGL2) return P;
    const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fsGeo = new T.PlaneGeometry(2, 2);
    const quad = new T.Mesh(fsGeo);
    quad.frustumCulled = false;
    const fsScene = new T.Scene();
    fsScene.add(quad);
    const mk = (fs, extra) =>
      new T.ShaderMaterial(
        Object.assign(
          {
            vertexShader: VS,
            fragmentShader: fs,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          },
          extra || {}
        )
      );
    const down = mk(DOWN_FS, { uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThresh: { value: 1 }, uKnee: { value: 0.5 }, uFirst: { value: 0 } } });
    const up = mk(UP_FS, { uniforms: { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uScatter: { value: 1 } }, blending: T.AdditiveBlending, transparent: true });
    let comp = null;
    let main = null;
    let mips = [];
    let W = 0;
    let H = 0;
    const N = quality === "high" ? 5 : 4;
    P.params = { bloom: 0.3, threshold: 1.0, sat: 1.08, contrast: 1.05, vignette: 0.26, split: 1, lift: 0 };

    function buildComp() {
      if (comp) comp.dispose();
      const defines = { PB_BLOOM: 1 };
      if (P.hdr) defines.PB_HDR = 1;
      if (!P.samples) defines.PB_FXAA = 1;
      comp = mk(COMP_FS, {
        defines,
        toneMapped: P.hdr,
        uniforms: {
          tScene: { value: null },
          tBloom: { value: null },
          uBloom: { value: 0.3 },
          uRes: { value: new T.Vector2(1, 1) },
          uTexel: { value: new T.Vector2(1, 1) },
          uSat: { value: 1.08 },
          uContrast: { value: 1.05 },
          uVignette: { value: 0.26 },
          uSplit: { value: 1 },
          uLift: { value: 0 },
        },
      });
    }
    function disposeTargets() {
      if (main) main.dispose();
      for (const m of mips) m.dispose();
      main = null;
      mips = [];
    }
    // フレームバッファが本当に使えるか (使えなければ黒い画面になるので諦める)
    function complete(rt) {
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      // MSAA のときは解決先 (テクスチャ) のフレームバッファも確かめる
      const pp = rt.samples > 0 && renderer.properties ? renderer.properties.get(rt) : null;
      if (ok && pp && pp.__webglFramebuffer) {
        renderer.state.bindFramebuffer(gl.FRAMEBUFFER, pp.__webglFramebuffer);
        ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      }
      renderer.setRenderTarget(prev);
      return ok;
    }
    function build(w, h) {
      disposeTargets();
      W = w;
      H = h;
      const wantS = opts.force === "fxaa" ? 0 : quality === "high" ? 4 : 2;
      const tryMake = (hdr) => {
        const type = hdr ? T.HalfFloatType : T.UnsignedByteType;
        const fmt = hdr ? gl.RGBA16F : gl.RGBA8;
        const samples = pickSamples(gl, fmt, wantS);
        const rt = new T.WebGLRenderTarget(w, h, { type, samples, depthBuffer: true, stencilBuffer: false });
        rt.texture.generateMipmaps = false;
        if (!hdr) {
          // 8bit のときはトーンマップと sRGB を描画中にかける (three は XR 用の目印があると RenderTarget にもかける)
          rt.isXRRenderTarget = true;
          rt.texture.colorSpace = T.SRGBColorSpace;
          rt.texture.internalFormat = "RGBA8";
        }
        if (!complete(rt)) {
          rt.dispose();
          return null;
        }
        P.samples = samples;
        P.hdr = hdr;
        return rt;
      };
      main = (opts.force !== "ldr" && canHalf(renderer) && tryMake(true)) || tryMake(false);
      if (!main) return false;
      const mt = P.hdr ? T.HalfFloatType : T.UnsignedByteType;
      let mw = w;
      let mh = h;
      for (let i = 0; i < N; i++) {
        mw = Math.max(1, mw >> 1);
        mh = Math.max(1, mh >> 1);
        const rt = new T.WebGLRenderTarget(mw, mh, { type: mt, depthBuffer: false, stencilBuffer: false });
        rt.texture.generateMipmaps = false;
        mips.push(rt);
      }
      if (!complete(mips[0])) return false;
      buildComp();
      return true;
    }
    function pass(mat, target) {
      quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(fsScene, fsCam);
    }

    // 描画先のサイズ (実ピクセル)
    P.setSize = function (w, h) {
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      if (P.failed) return false;
      if (main && w === W && h === H) return true;
      P.ok = build(w, h);
      if (!P.ok) {
        disposeTargets();
        P.failed = true;
      }
      return P.ok;
    };
    // シーンを描く前に呼ぶ: 描画先を切り替えて消す
    P.begin = function () {
      if (!P.ok || !main) return false;
      renderer.setRenderTarget(main);
      return true;
    };
    P.target = () => main;
    // 打者レイヤーの 2 回目の描画の前に呼ぶ (深度だけ消す)
    P.clearDepth = function () {
      renderer.setRenderTarget(main);
      renderer.clearDepth();
    };
    // bloom と仕上げを画面に出す
    P.end = function (o) {
      const pr = o || P.params;
      const ac = renderer.autoClear;
      renderer.autoClear = true;
      const useBloom = pr.bloom > 0;
      const thr = pr.threshold || 1;
      if (useBloom) {
        let src = main.texture;
        let sw = W;
        let sh = H;
        for (let i = 0; i < mips.length; i++) {
          down.uniforms.tSrc.value = src;
          down.uniforms.uTexel.value.set(1 / sw, 1 / sh);
          down.uniforms.uFirst.value = i === 0 ? 1 : 0;
          down.uniforms.uThresh.value = P.hdr ? thr : Math.min(0.9, thr * 0.8);
          down.uniforms.uKnee.value = P.hdr ? 0.5 * thr : 0.1;
          pass(down, mips[i]);
          src = mips[i].texture;
          sw = mips[i].width;
          sh = mips[i].height;
        }
        renderer.autoClear = false;
        for (let i = mips.length - 1; i > 0; i--) {
          up.uniforms.tSrc.value = mips[i].texture;
          up.uniforms.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height);
          up.uniforms.uScatter.value = 0.85;
          pass(up, mips[i - 1]);
        }
        renderer.autoClear = true;
      }
      const u = comp.uniforms;
      u.tScene.value = main.texture;
      u.tBloom.value = mips[0].texture;
      u.uBloom.value = useBloom ? pr.bloom / mips.length : 0;
      u.uRes.value.set(W, H);
      u.uTexel.value.set(1 / W, 1 / H);
      u.uSat.value = pr.sat != null ? pr.sat : 1.08;
      u.uContrast.value = pr.contrast != null ? pr.contrast : 1.05;
      u.uVignette.value = pr.vignette != null ? pr.vignette : 0.26;
      u.uSplit.value = pr.split != null ? pr.split : 1;
      u.uLift.value = pr.lift || 0;
      pass(comp, null);
      renderer.autoClear = ac;
    };
    // コンテキストが戻ったら作り直す
    P.reset = function () {
      // 古いコンテキストの GL オブジェクトは消えているので dispose せずに手放す
      main = null;
      mips = [];
      W = H = 0;
      P.failed = false;
      P.ok = false;
    };
    P.dispose = function () {
      disposeTargets();
      down.dispose();
      up.dispose();
      if (comp) comp.dispose();
      fsGeo.dispose();
      P.ok = false;
    };
    P.ok = true; // setSize で本当に作れるか確かめる
    return P;
  };
})((window.PB = window.PB || {}));
