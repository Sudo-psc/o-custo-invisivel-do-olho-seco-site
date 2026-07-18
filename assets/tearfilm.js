/*
 * tearfilm.js — Simulação de filme lacrimal em WebGL2.
 *
 * O olho seco é, na origem, uma instabilidade do filme lacrimal: a fina camada
 * que cobre a córnea rompe-se em "pontos secos" antes do próximo piscar. Esse
 * mesmo filme exibe interferência de película fina — a iridescência que se vê
 * em meibografia. Aqui, o fenômeno vira a linguagem visual da página:
 *
 *   - o filme se estabiliza e se rompe sozinho ao longo do tempo;
 *   - a "secura" cresce conforme a rolagem (uDry), abrindo manchas escuras;
 *   - mover o ponteiro ou clicar "molha" a superfície e dispara uma onda.
 *
 * Camada puramente decorativa: nenhum conteúdo essencial depende dela.
 * Degrada com elegância e nunca gasta recursos à toa:
 *   - sem WebGL2, prefers-reduced-motion, Save-Data, pouca RAM/núcleos, ou
 *     com "modo calmo" ligado → cai para um gradiente estático em CSS;
 *   - pausa quando o herói sai da tela ou quando a aba fica oculta;
 *   - expõe window.__tearfilm.setCalm(bool) para o botão de modo calmo.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("tearfilm");
  if (!canvas) return;

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Detecção de capacidade: não ligar o shader em hardware/rede modestos.
  const conn = navigator.connection || {};
  const lowPower =
    conn.saveData === true ||
    (typeof navigator.deviceMemory === "number" && navigator.deviceMemory < 4) ||
    (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency < 4);

  let gl = null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: false, antialias: false, powerPreference: "high-performance", premultipliedAlpha: false,
    });
  } catch (_) { gl = null; }

  // Capacidade estrutural (independe da preferência do usuário por modo calmo).
  const hardwareCapable = !!gl && !reduceMotion && !lowPower;

  function toFallback() {
    root.classList.remove("has-tearfilm");
    root.classList.add("no-tearfilm");
  }

  // API pública mínima para o botão "modo calmo".
  const api = { capable: hardwareCapable, setCalm: () => {}, running: false };
  window.__tearfilm = api;

  if (!hardwareCapable) {
    toFallback();
    return; // sem contexto GL: fica no gradiente CSS, toggle é apenas de animações.
  }

  const VERT = `#version 300 es
  precision highp float;
  const vec2 pos[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  void main(){ gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uPointer;
  uniform float uBlink;
  uniform float uDry;

  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.55; const mat2 m=mat2(1.62,1.18,-1.18,1.62);
    for(int i=0;i<6;i++){ v+=a*noise(p); p=m*p+3.1; a*=0.5; } return v;
  }
  vec3 iridescence(float t){
    vec3 c = 0.5 + 0.5*cos(6.28318*(vec3(0.62,0.50,0.36)+t));
    return mix(c, c*vec3(0.55,0.85,1.15), 0.55);
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p  = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
    vec2 ptr = (uPointer - 0.5) * vec2(uRes.x/uRes.y, 1.0);
    float t = uTime;

    vec2 q = vec2(fbm(p*2.4 + vec2(0.0,t*0.06)), fbm(p*2.4 + vec2(5.2,t*0.05+1.7)));
    vec2 r = vec2(fbm(p*2.4 + 2.4*q + vec2(1.7,9.2)), fbm(p*2.4 + 2.4*q + vec2(8.3,2.8)));
    float film = fbm(p*3.0 + 2.6*r);

    float d = length(p - ptr);
    float ripple = sin(d*26.0 - t*7.0) * exp(-d*7.0) * uBlink;
    float wet = smoothstep(0.55, 0.0, d) * uBlink;
    film += ripple*0.12 + wet*0.25;

    float thickness = film + 0.35*r.x + 0.12*sin(t*0.2 + p.x*3.0);

    float dryField = fbm(p*1.7 - vec2(t*0.03,t*0.02) + 11.0);
    float dryCut   = mix(0.74, 0.40, clamp(uDry,0.0,1.0));
    float dryness  = smoothstep(dryCut, dryCut-0.16, dryField);
    dryness *= (1.0 - wet);

    vec3 deep = vec3(0.02,0.07,0.14);
    vec3 film_c = iridescence(thickness*1.5 + 0.10);
    film_c *= 0.75 + 0.9*smoothstep(0.05,0.95,film);
    float bands = pow(smoothstep(0.55,1.0, film + 0.3*sin(thickness*9.0 + t*0.3)), 2.0);
    film_c += bands * vec3(0.35,0.55,0.7);

    float spec = pow(smoothstep(0.5,0.0,d), 3.0) * (0.4 + 0.7*uBlink);

    vec3 col = mix(deep, film_c, (1.0 - dryness) * (0.72 + 0.28*film));
    col += spec * vec3(0.7,0.9,1.0) * 0.55;
    col = mix(col, deep*0.6, dryness*0.9);

    float grain = (hash(uv*uRes + t) - 0.5) * 0.022;
    float vig = smoothstep(1.2,0.3, length((uv-0.5)*vec2(1.12,1.0)));
    col = (col + grain) * mix(0.78,1.05,vig);

    col = col / (col + 0.72);
    col = pow(col, vec3(0.82));
    fragColor = vec4(col, 1.0);
  }`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("tearfilm shader:", gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { toFallback(); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { toFallback(); return; }
  gl.useProgram(prog);

  const u = {
    res: gl.getUniformLocation(prog, "uRes"),
    time: gl.getUniformLocation(prog, "uTime"),
    pointer: gl.getUniformLocation(prog, "uPointer"),
    blink: gl.getUniformLocation(prog, "uBlink"),
    dry: gl.getUniformLocation(prog, "uDry"),
  };
  gl.bindVertexArray(gl.createVertexArray());

  const pointer = { x: 0.5, y: 0.55, tx: 0.5, ty: 0.55 };
  let blink = 0, dry = 0, dryTarget = 0;
  let heroVisible = true;
  let rafId = 0;
  let last = 0, elapsed = 0, nextAutoBlink = 2600;
  let canvasRect = null; // cacheado: o canvas é fixed, só muda no resize

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    canvasRect = canvas.getBoundingClientRect();
  }

  function pointerMove(clientX, clientY) {
    if (!api.running) return; // modo calmo/pausado: nada a fazer
    if (!canvasRect) canvasRect = canvas.getBoundingClientRect();
    pointer.tx = (clientX - canvasRect.left) / canvasRect.width;
    pointer.ty = 1 - (clientY - canvasRect.top) / canvasRect.height;
    blink = Math.min(1, blink + 0.12);
  }

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    dryTarget = max > 0 ? Math.min(1, window.scrollY / max) * 0.9 : 0;
  }

  window.addEventListener("pointermove", (e) => pointerMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("pointerdown", (e) => { pointerMove(e.clientX, e.clientY); blink = 1; }, { passive: true });
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", onScroll, { passive: true });

  // Pausa quando o herói (fonte visível do fundo animado) sai da viewport.
  const hero = document.getElementById("topo");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
      if (api.running && heroVisible) kick();
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener("visibilitychange", () => { if (api.running && !document.hidden) kick(); });

  function frame(now) {
    rafId = 0;
    if (!api.running || document.hidden || !heroVisible) return; // pausa sem agendar
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt * 1000;

    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    blink += (0 - blink) * 0.9 * dt * 3;
    if (blink < 0.001) blink = 0;
    dry += (dryTarget - dry) * 0.05;

    if (elapsed > nextAutoBlink) {
      blink = Math.max(blink, 0.5);
      pointer.tx = 0.35 + Math.abs(Math.sin(now * 0.0007)) * 0.3;
      pointer.ty = 0.55 + Math.cos(now * 0.0005) * 0.12;
      nextAutoBlink = elapsed + 3200 + (now % 1800);
    }

    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, now * 0.001);
    gl.uniform2f(u.pointer, pointer.x, pointer.y);
    gl.uniform1f(u.blink, blink);
    gl.uniform1f(u.dry, dry);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    kick();
  }
  function kick() { if (!rafId) rafId = requestAnimationFrame(frame); }

  function start() {
    if (api.running) return;
    api.running = true;
    root.classList.remove("no-tearfilm");
    root.classList.add("has-tearfilm");
    resize(); onScroll(); last = 0;
    kick();
  }
  function stop() {
    api.running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    // Volta ao gradiente CSS enquanto o shader estiver parado por escolha.
    toFallback();
  }

  // Modo calmo: preferência do usuário, persistida. Ligado → shader parado.
  api.setCalm = (calm) => {
    root.classList.toggle("calm", !!calm);
    if (calm) stop(); else start();
  };

  const calmStored = localStorage.getItem("calmMode") === "1";
  if (calmStored) { root.classList.add("calm"); toFallback(); }
  else start();
})();
