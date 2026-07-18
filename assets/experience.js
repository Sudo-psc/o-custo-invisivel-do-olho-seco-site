/*
 * experience.js — camada de interação da landing.
 * Não coleta nem transmite dados; usa apenas window.bookTrack (dataLayer local).
 */
(() => {
  "use strict";
  const root = document.documentElement;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const track = (name, detail) => (window.bookTrack ? window.bookTrack(name, detail) : void 0);
  const $ = (id) => document.getElementById(id);

  /* --- modo calmo: preferência do usuário para reduzir animações ---------- */
  const calmBtn = $("calm-toggle");
  function applyCalm(on, persist) {
    root.classList.toggle("calm", on);
    if (calmBtn) {
      calmBtn.setAttribute("aria-pressed", String(on));
      const label = calmBtn.querySelector(".calm-label");
      if (label) label.textContent = on ? "Animações desligadas" : "Modo calmo";
    }
    if (window.__tearfilm && typeof window.__tearfilm.setCalm === "function") {
      window.__tearfilm.setCalm(on);
    }
    if (persist) {
      try { localStorage.setItem("calmMode", on ? "1" : "0"); } catch (_) {}
    }
  }
  // Estado inicial: preferência salva ou prefers-reduced-motion.
  let calmInit = false;
  try { calmInit = localStorage.getItem("calmMode") === "1"; } catch (_) {}
  applyCalm(calmInit || mq.matches, false);
  if (calmBtn) {
    calmBtn.addEventListener("click", () => {
      const next = calmBtn.getAttribute("aria-pressed") !== "true";
      applyCalm(next, true);
      track("calm_mode_toggle", { enabled: next });
    });
  }

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
  const num = (id) => Number($(id) && $(id).value ? $(id).value : 0);

  function animateTo(el, target, fmt) {
    if (root.classList.contains("calm") || !Number.isFinite(target)) { el.textContent = fmt(target); return; }
    const start = performance.now(), dur = 650;
    function tick(now) {
      const k = Math.min(1, (now - start) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function computeScenario() {
    const n = num("n"), c = num("c"), p = num("p"), l = num("l"), k = num("k");
    const capacity = n * c * (p / 100) * (l / 100);
    const threshold = capacity > 0 && k > 0 ? k / capacity : null;
    const capEl = $("out-capacity");
    if (capacity > 0) animateTo(capEl, capacity, (v) => money.format(v));
    else capEl.textContent = "indisponível";
    $("out-threshold").textContent = threshold !== null
      ? `${(threshold * 100).toFixed(1).replace(".", ",")}%`
      : "indisponível";
    $("out-roi").textContent = "indisponível antes de benefício incremental, atribuível e auditável.";
    track("capacity_calculation", { inputs_complete: capacity > 0 && k > 0 });
  }

  const form = $("calc-form");
  if (form) form.addEventListener("submit", (e) => { e.preventDefault(); computeScenario(); });

  /* --- painel scrollytelling: ruptura do filme lacrimal (canvas 2D) ------- */
  const stageCanvas = $("breakup");
  if (stageCanvas && !mq.matches) {
    const ctx = stageCanvas.getContext("2d");
    let dpr = 1, W = 0, H = 0, dryness = 0, visible = true, rafId = 0;

    const spots = Array.from({ length: 46 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.03 + Math.random() * 0.06,
      phase: Math.random() * Math.PI * 2,
      order: Math.random(),
    }));

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = stageCanvas.width = stageCanvas.clientWidth * dpr;
      H = stageCanvas.height = stageCanvas.clientHeight * dpr;
    }
    size();
    window.addEventListener("resize", size);

    const stageEl = stageCanvas.closest(".stage") || stageCanvas.parentElement;
    function updateDryness() {
      const rect = stageEl.getBoundingClientRect();
      const prog = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      dryness = Math.max(0, Math.min(1, prog * 1.15 - 0.05));
    }
    window.addEventListener("scroll", updateDryness, { passive: true });
    updateDryness();

    function draw(t) {
      rafId = 0;
      if (!visible || document.hidden || root.classList.contains("calm")) return;
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0a3a5e"); g.addColorStop(0.5, "#12608a"); g.addColorStop(1, "#0a2a52");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 5; i++) {
        const y = (0.15 + i * 0.18 + Math.sin(t * 0.0004 + i) * 0.03) * H;
        const grd = ctx.createLinearGradient(0, y - H * 0.09, 0, y + H * 0.09);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(0.5, `hsla(${180 + i * 22},70%,60%,0.22)`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd; ctx.fillRect(0, y - H * 0.09, W, H * 0.18);
      }

      ctx.globalCompositeOperation = "multiply";
      for (const s of spots) {
        const open = Math.max(0, dryness - s.order) / (1 - s.order + 0.0001);
        if (open <= 0) continue;
        const rad = s.r * (0.4 + open) * (1 + 0.12 * Math.sin(t * 0.002 + s.phase)) * Math.min(W, H);
        const cx = s.x * W, cy = s.y * H;
        const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        rg.addColorStop(0, "rgba(3,10,20,0.95)");
        rg.addColorStop(0.7, "rgba(4,16,31,0.6)");
        rg.addColorStop(1, "rgba(4,16,31,0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      ctx.fillStyle = "rgba(221,248,251,0.9)";
      ctx.font = `${14 * dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(`instabilidade do filme: ${Math.round(dryness * 100)}%`, 16 * dpr, 16 * dpr);

      kick();
    }
    function kick() { if (!rafId) rafId = requestAnimationFrame(draw); }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) kick();
      }, { threshold: 0 }).observe(stageCanvas);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    kick();
  }

  track("experience_ready", {
    webgl: !!(window.__tearfilm && window.__tearfilm.capable),
    calm: root.classList.contains("calm"),
  });
})();
