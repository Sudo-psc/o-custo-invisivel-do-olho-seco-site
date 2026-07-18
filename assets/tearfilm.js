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
 *   - mover o ponteiro ou clicar "molha" a superfície e dispara uma onda —
 *     o gesto de piscar, que reidrata a córnea.
 *
 * Sem dependências externas. Degrada com elegância: se não houver WebGL2 ou se
 * o usuário pedir menos movimento, cai para um gradiente estático em CSS.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("tearfilm");
  if (!canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
  });

  // Fallback gracioso: marca o corpo para que o CSS assuma um gradiente vivo.
  if (!gl || reduceMotion) {
    document.documentElement.classList.add("no-tearfilm");
    return;
  }
  document.documentElement.classList.add("has-tearfilm");

  const VERT = `#version 300 es
  precision highp float;
  const vec2 pos[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  void main(){ gl_Position = vec4(pos[gl_VertexID], 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec2  uPointer;   // posição do ponteiro em 0..1 (y para cima)
  uniform float uBlink;     // 0..1, decai após cada piscar
  uniform float uDry;       // 0..1, secura acumulada pela rolagem

  // --- ruído de valor + fbm -------------------------------------------------
  float hash(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0,0.0));
    float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
    vec2 u = f*f*(3.0 - 2.0*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.55;
    const mat2 m = mat2(1.62, 1.18, -1.18, 1.62);
    for(int i=0;i<6;i++){ v += a*noise(p); p = m*p + 3.1; a *= 0.5; }
    return v;
  }

  // Interferência de película fina, aproximada por uma paleta cosseno e
  // deslocada para os azuis da identidade (córnea sob luz clínica).
  vec3 iridescence(float t){
    vec3 c = 0.5 + 0.5*cos(6.28318*(vec3(0.62, 0.50, 0.36) + t));
    // viés para ciano/azul, sem estourar a saturação
    return mix(c, c*vec3(0.55,0.85,1.15), 0.55);
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p  = (gl_FragCoord.xy - 0.5*uRes) / uRes.y; // aspecto corrigido
    vec2 ptr = (uPointer - 0.5) * vec2(uRes.x/uRes.y, 1.0);

    float t = uTime;

    // Domain warping: o filme "escorre" lentamente.
    vec2 q = vec2(fbm(p*2.4 + vec2(0.0, t*0.06)),
                  fbm(p*2.4 + vec2(5.2, t*0.05 + 1.7)));
    vec2 r = vec2(fbm(p*2.4 + 2.4*q + vec2(1.7, 9.2)),
                  fbm(p*2.4 + 2.4*q + vec2(8.3, 2.8)));
    float film = fbm(p*3.0 + 2.6*r);

    // Onda do piscar: reidrata e propaga a partir do ponteiro.
    float d = length(p - ptr);
    float ripple = sin(d*26.0 - t*7.0) * exp(-d*7.0) * uBlink;
    float wet = smoothstep(0.55, 0.0, d) * uBlink;         // molha ao redor do gesto
    film += ripple*0.12 + wet*0.25;

    // Espessura do filme: espinha da interferência.
    float thickness = film + 0.35*r.x + 0.12*sin(t*0.2 + p.x*3.0);

    // Pontos secos: ruído lento cruzando um limiar que sobe com uDry.
    float dryField = fbm(p*1.7 - vec2(t*0.03, t*0.02) + 11.0);
    float dryCut   = mix(0.74, 0.40, clamp(uDry,0.0,1.0));
    float dryness  = smoothstep(dryCut, dryCut-0.16, dryField); // 1 = rompido
    dryness *= (1.0 - wet);                                     // o piscar cura

    // Cores.
    vec3 deep = vec3(0.02, 0.07, 0.14);             // navy profundo (córnea na sombra)
    vec3 film_c = iridescence(thickness*1.5 + 0.10);
    film_c *= 0.75 + 0.9*smoothstep(0.05, 0.95, film); // brilho conforme a espessura
    // Reflexos de banda fina: realça as cristas da interferência.
    float bands = pow(smoothstep(0.55, 1.0, film + 0.3*sin(thickness*9.0 + t*0.3)), 2.0);
    film_c += bands * vec3(0.35, 0.55, 0.7);

    // Realce especular perto do ponteiro (reflexo úmido).
    float spec = pow(smoothstep(0.5, 0.0, d), 3.0) * (0.4 + 0.7*uBlink);

    vec3 col = mix(deep, film_c, (1.0 - dryness) * (0.72 + 0.28*film));
    col += spec * vec3(0.7, 0.9, 1.0) * 0.55;
    col = mix(col, deep*0.6, dryness*0.9);          // manchas secas escurecem

    // Grão fino para quebrar bandas + vinheta.
    float grain = (hash(uv*uRes + t) - 0.5) * 0.022;
    float vig = smoothstep(1.2, 0.3, length((uv-0.5)*vec2(1.12,1.0)));
    col = (col + grain) * mix(0.78, 1.05, vig);

    // Tonemapping suave para conter os brancos preservando a cor.
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
  if (!vs || !fs) {
    document.documentElement.classList.remove("has-tearfilm");
    document.documentElement.classList.add("no-tearfilm");
    return;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    document.documentElement.classList.add("no-tearfilm");
    return;
  }
  gl.useProgram(prog);

  const u = {
    res: gl.getUniformLocation(prog, "uRes"),
    time: gl.getUniformLocation(prog, "uTime"),
    pointer: gl.getUniformLocation(prog, "uPointer"),
    blink: gl.getUniformLocation(prog, "uBlink"),
    dry: gl.getUniformLocation(prog, "uDry"),
  };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Estado dinâmico.
  const pointer = { x: 0.5, y: 0.55, tx: 0.5, ty: 0.55 };
  let blink = 0.0;
  let dry = 0.0;
  let dryTarget = 0.0;
  let running = true;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function pointerMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.tx = (clientX - rect.left) / rect.width;
    pointer.ty = 1.0 - (clientY - rect.top) / rect.height;
    blink = Math.min(1.0, blink + 0.12);
  }

  function blinkPulse() {
    blink = 1.0;
  }

  window.addEventListener("pointermove", (e) => pointerMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener("pointerdown", (e) => { pointerMove(e.clientX, e.clientY); blinkPulse(); }, { passive: true });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });

  // A secura cresce com a rolagem — a página inteira "resseca" ao descer,
  // e o piscar (interação) alivia localmente.
  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    dryTarget = max > 0 ? Math.min(1.0, window.scrollY / max) * 0.9 : 0.0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Piscar automático periódico, sutil, mesmo sem interação.
  let nextAutoBlink = 2600;
  let elapsed = 0;
  let last = 0;

  resize();

  function frame(now) {
    if (!running) return;
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += now === 0 ? 0 : dt * 1000;

    // Suavização.
    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    blink += (0.0 - blink) * 0.9 * dt * 3.0;
    if (blink < 0.001) blink = 0.0;
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

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
