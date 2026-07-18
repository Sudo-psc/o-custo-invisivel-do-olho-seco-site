/*
 * experience.js — camada de interação da landing.
 * Não coleta nem transmite dados; usa apenas window.bookTrack (dataLayer local).
 */
(() => {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const track = (name, detail) => (window.bookTrack ? window.bookTrack(name, detail) : void 0);

  /* --- brilho que segue o ponteiro nos botões ---------------------------- */
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty("--mx", `${e.clientX - r.left}px`);
      btn.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* --- calculadora de capacidade e limiar -------------------------------- */
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const $ = (id) => document.getElementById(id);
  const num = (id) => Number($(id) && $(id).value ? $(id).value : 0);

  function animateTo(el, target, fmt) {
    if (reduce || !Number.isFinite(target)) { el.textContent = fmt(target); return; }
    const start = performance.now();
    const dur = 650;
    const from = 0;
    function tick(now) {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (target - from) * e);
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const calcBtn = $("calc");
  if (calcBtn) {
    calcBtn.addEventListener("click", () => {
      const n = num("n"), c = num("c"), p = num("p"), l = num("l"), k = num("k");
      const capacity = n * c * (p / 100) * (l / 100);
      const threshold = capacity > 0 && k > 0 ? k / capacity : null;

      const capEl = $("out-capacity");
      const thrEl = $("out-threshold");
      if (capacity > 0) animateTo(capEl, capacity, (v) => money.format(v));
      else capEl.textContent = "indisponível";

      thrEl.textContent = threshold !== null
        ? `${(threshold * 100).toFixed(1).replace(".", ",")}%`
        : "indisponível";

      $("out-roi").textContent = "indisponível antes de benefício incremental, atribuível e auditável.";
      track("capacity_calculation", { inputs_complete: capacity > 0 && k > 0 });
    });
  }

  /* --- painel scrollytelling: ruptura do filme lacrimal (canvas 2D) ------- */
  const stageCanvas = document.getElementById("breakup");
  if (stageCanvas && !reduce) {
    const ctx = stageCanvas.getContext("2d");
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let dryness = 0; // 0..1 acompanha a rolagem sobre a própria seção

    // Semente de "buracos secos" distribuídos.
    const spots = Array.from({ length: 46 }, (_, i) => ({
      x: Math.random(), y: Math.random(),
      r: 0.03 + Math.random() * 0.06,
      phase: Math.random() * Math.PI * 2,
      order: Math.random(),
    }));

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = stageCanvas.clientWidth * dpr;
      H = stageCanvas.clientHeight * dpr;
      stageCanvas.width = W;
      stageCanvas.height = H;
    }
    size();
    window.addEventListener("resize", size);

    const stageEl = stageCanvas.closest(".stage") || stageCanvas.parentElement;
    function updateDryness() {
      const rect = stageEl.getBoundingClientRect();
      const vh = window.innerHeight;
      // progresso: 0 quando a seção entra, 1 quando está saindo pelo topo.
      const prog = (vh - rect.top) / (vh + rect.height);
      dryness = Math.max(0, Math.min(1, prog * 1.15 - 0.05));
    }
    window.addEventListener("scroll", updateDryness, { passive: true });
    updateDryness();

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      // base iridescente
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0a3a5e");
      g.addColorStop(0.5, "#12608a");
      g.addColorStop(1, "#0a2a52");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // bandas de interferência sutis
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 5; i++) {
        const y = (0.15 + i * 0.18 + Math.sin(t * 0.0004 + i) * 0.03) * H;
        const grd = ctx.createLinearGradient(0, y - H * 0.09, 0, y + H * 0.09);
        const hue = 180 + i * 22;
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(0.5, `hsla(${hue},70%,60%,0.22)`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, y - H * 0.09, W, H * 0.18);
      }

      // pontos secos que abrem conforme a secura
      ctx.globalCompositeOperation = "multiply";
      for (const s of spots) {
        const open = Math.max(0, dryness - s.order) / (1 - s.order + 0.0001);
        if (open <= 0) continue;
        const pr = s.r * (0.4 + open) * (1 + 0.12 * Math.sin(t * 0.002 + s.phase));
        const cx = s.x * W, cy = s.y * H, rad = pr * Math.min(W, H);
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        rg.addColorStop(0, "rgba(3,10,20,0.95)");
        rg.addColorStop(0.7, "rgba(4,16,31,0.6)");
        rg.addColorStop(1, "rgba(4,16,31,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // rótulo de estado
      ctx.fillStyle = "rgba(221,248,251,0.9)";
      ctx.font = `${14 * dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      const pct = Math.round(dryness * 100);
      ctx.fillText(`instabilidade do filme: ${pct}%`, 16 * dpr, 16 * dpr);

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  /* --- rastreio dos alvos de interesse ----------------------------------- */
  track("experience_ready", { webgl: document.documentElement.classList.contains("has-tearfilm") });
})();
