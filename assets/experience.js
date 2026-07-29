(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const root = document.documentElement;
  const header = document.querySelector("[data-header]");
  const progressValue = document.querySelector("[data-scroll-value]");

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  function updateScrollState() {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const progress = clamp(scrollY / scrollable);
    root.style.setProperty("--page-progress", progress.toFixed(4));
    if (progressValue) progressValue.textContent = String(Math.round(progress * 100)).padStart(2, "0");
    header?.classList.toggle("is-scrolled", scrollY > 24);
  }

  let scrollQueued = false;
  addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      updateScrollState();
      scrollQueued = false;
    });
  }, { passive: true });
  updateScrollState();

  const revealTargets = document.querySelectorAll(
    ".section-heading, .book-intro, .calculator-heading, .reader-paths article, .decision-routes a, .availability-status, .format-ledger > div, .faq-list details"
  );
  revealTargets.forEach((node) => node.dataset.reveal = "");

  if ("IntersectionObserver" in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    revealTargets.forEach((node) => revealObserver.observe(node));
  } else {
    revealTargets.forEach((node) => node.classList.add("is-visible"));
  }

  const sceneSections = [...document.querySelectorAll("[data-scene]")];
  let scene = 0;
  if ("IntersectionObserver" in window) {
    const sceneObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) scene = Number(visible.target.dataset.scene || 0);
    }, { threshold: [.15, .35, .6] });
    sceneSections.forEach((section) => sceneObserver.observe(section));
  }

  const gateData = [
    {
      title: "Implementação",
      description: "A intervenção aconteceu como planejado, com adesão, alcance e qualidade verificáveis?"
    },
    {
      title: "Clínico",
      description: "Os desfechos clínicos ou sintomáticos mudaram segundo instrumento, população e janela previamente definidos?"
    },
    {
      title: "Operacional",
      description: "Algum indicador operacional definido antes do piloto mudou, com denominador e qualidade de dado suficientes?"
    },
    {
      title: "Financeiro",
      description: "Existe benefício incremental atribuível observado, custo efetivo no mesmo horizonte e possibilidade real de efeito zero?"
    }
  ];

  const gateNodes = [...document.querySelectorAll("[data-gate]")];
  const gateCounter = document.querySelector("[data-gate-counter]");
  const gateTitle = document.querySelector("[data-gate-title]");
  const gateDescription = document.querySelector("[data-gate-description]");

  function activateGate(index) {
    const gate = gateData[index];
    if (!gate) return;
    gateNodes.forEach((node, nodeIndex) => {
      const active = nodeIndex === index;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", String(active));
    });
    if (gateCounter) gateCounter.textContent = `Gate ${String(index + 1).padStart(2, "0")}`;
    if (gateTitle) gateTitle.textContent = gate.title;
    if (gateDescription) gateDescription.textContent = gate.description;
  }

  gateNodes.forEach((node) => {
    node.addEventListener("click", () => activateGate(Number(node.dataset.gate)));
  });

  if (!reducedMotion) {
    let gateIndex = 0;
    let gateTimer = setInterval(() => {
      gateIndex = (gateIndex + 1) % gateData.length;
      activateGate(gateIndex);
    }, 5200);

    document.querySelector("[data-gate-console]")?.addEventListener("pointerenter", () => {
      clearInterval(gateTimer);
    }, { once: true });
  }

  const form = document.querySelector("#capacity-form");
  const capacityNode = document.querySelector("[data-capacity]");
  const thresholdNode = document.querySelector("[data-threshold]");
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = (id) => Number(document.getElementById(id)?.value || 0);
    const n = Math.max(0, value("n"));
    const c = Math.max(0, value("c"));
    const p = clamp(value("p"), 0, 100) / 100;
    const l = clamp(value("l"), 0, 100) / 100;
    const k = Math.max(0, value("k"));
    const capacity = n * c * p * l;
    const threshold = capacity > 0 && k > 0 ? k / capacity : null;

    if (capacityNode) {
      capacityNode.textContent = capacity > 0 ? money.format(capacity) : "Indisponível";
    }
    if (thresholdNode) {
      thresholdNode.textContent = threshold === null
        ? "Indisponível"
        : `${(threshold * 100).toFixed(1).replace(".", ",")}%`;
    }
    window.bookTrack?.("capacity_calculation", { inputs_complete: capacity > 0 && k > 0 });
  });

  document.querySelectorAll("details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;
      document.querySelectorAll("details[open]").forEach((other) => {
        if (other !== detail) other.open = false;
      });
    });
  });

  function initOcularField() {
    const canvas = document.getElementById("ocular-field");
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: coarsePointer ? "low-power" : "high-performance"
    });

    if (!gl) {
      canvas.hidden = true;
      document.body.classList.add("no-webgl");
      return;
    }

    const vertexSource = `#version 300 es
      precision highp float;
      const vec2 POSITIONS[3] = vec2[3](
        vec2(-1.0, -1.0),
        vec2(3.0, -1.0),
        vec2(-1.0, 3.0)
      );
      out vec2 vUv;
      void main() {
        vec2 position = POSITIONS[gl_VertexID];
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }`;

    const fragmentSource = `#version 300 es
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform vec2 uResolution;
      uniform vec2 uPointer;
      uniform float uTime;
      uniform float uScroll;
      uniform float uScene;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p = rotation * p * 2.03 + 12.3;
          amplitude *= 0.48;
        }
        return value;
      }

      float ring(vec2 p, float radius, float width) {
        return smoothstep(width, 0.0, abs(length(p) - radius));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
        vec2 pointer = (uPointer * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
        float t = uTime * 0.11;
        float sceneMix = clamp(uScene / 10.0, 0.0, 1.0);

        vec2 warp = vec2(
          fbm(uv * 1.3 + vec2(t, -t * .7)),
          fbm(uv * 1.25 + vec2(-t * .5, t))
        ) - .5;
        vec2 fluidUv = uv + warp * (.18 + uScroll * .08);

        float film = fbm(fluidUv * 2.2 + t);
        float fine = fbm(fluidUv * 6.0 - t * 1.7);
        float caustic = pow(max(0.0, sin((film + fine * .32) * 13.0 - t * 4.0)), 9.0);

        vec2 eyeCenter = vec2(mix(.32, -.18, uScroll), mix(.14, -.08, sceneMix));
        vec2 eyeUv = fluidUv - eyeCenter;
        eyeUv.x *= .78;
        float iris = ring(eyeUv, .34 + uScroll * .04, .014);
        float irisSoft = smoothstep(.55, .08, length(eyeUv));
        float pupil = smoothstep(.13, .1, length(eyeUv));

        float pointerGlow = exp(-3.4 * length(fluidUv - pointer * .38));
        float horizon = exp(-5.5 * abs(uv.y + .18 - warp.x * .32));
        float grid = smoothstep(.985, 1.0, sin(uv.x * 42.0) * sin(uv.y * 42.0));
        grid *= .025 * (1.0 - smoothstep(.2, 1.2, length(uv)));

        vec3 deep = vec3(.006, .025, .042);
        vec3 teal = vec3(.09, .72, .72);
        vec3 blue = vec3(.17, .34, .82);
        vec3 coral = vec3(.95, .29, .20);

        vec3 color = deep;
        color += teal * film * .11;
        color += blue * caustic * .12;
        color += teal * iris * (.22 + .24 * pupil);
        color += blue * irisSoft * .05;
        color += coral * horizon * .025 * sceneMix;
        color += teal * pointerGlow * .055;
        color += vec3(grid);

        float vignette = smoothstep(1.7, .35, length(uv * vec2(.76, 1.0)));
        float alpha = (.52 + film * .13 + iris * .2) * vignette;
        outColor = vec4(color, alpha);
      }`;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message || "Falha ao compilar shader");
      }
      return shader;
    }

    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Falha ao ligar shaders");
      }
    } catch (error) {
      console.warn("[ocular-field]", error);
      canvas.hidden = true;
      document.body.classList.add("no-webgl");
      return;
    }

    gl.useProgram(program);
    gl.bindVertexArray(gl.createVertexArray());

    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      time: gl.getUniformLocation(program, "uTime"),
      scroll: gl.getUniformLocation(program, "uScroll"),
      scene: gl.getUniformLocation(program, "uScene")
    };

    const pointer = { x: .72, y: .35, targetX: .72, targetY: .35 };
    addEventListener("pointermove", (event) => {
      pointer.targetX = event.clientX / innerWidth;
      pointer.targetY = 1 - event.clientY / innerHeight;
    }, { passive: true });

    let width = 0;
    let height = 0;
    function resize() {
      const maxDpr = coarsePointer ? 1 : 1.5;
      const dpr = Math.min(devicePixelRatio || 1, maxDpr);
      const nextWidth = Math.max(1, Math.floor(innerWidth * dpr));
      const nextHeight = Math.max(1, Math.floor(innerHeight * dpr));
      if (nextWidth === width && nextHeight === height) return;
      width = canvas.width = nextWidth;
      height = canvas.height = nextHeight;
      gl.viewport(0, 0, width, height);
    }

    let running = true;
    let frame = 0;
    const start = performance.now();
    function render(now) {
      if (!running) return;
      resize();
      pointer.x += (pointer.targetX - pointer.x) * .035;
      pointer.y += (pointer.targetY - pointer.y) * .035;

      const scrollable = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const scroll = clamp(scrollY / scrollable);
      gl.uniform2f(uniforms.resolution, width, height);
      gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
      gl.uniform1f(uniforms.time, (now - start) / 1000);
      gl.uniform1f(uniforms.scroll, scroll);
      gl.uniform1f(uniforms.scene, scene);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      frame += 1;
      if (reducedMotion && frame >= 1) return;
      requestAnimationFrame(render);
    }

    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(render);
    });
    requestAnimationFrame(render);
  }

  initOcularField();
})();
