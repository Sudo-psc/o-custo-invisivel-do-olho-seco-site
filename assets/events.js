/* Camada de coleta analítica — O Custo Invisível do Olho Seco.
 *
 * O contrato em ANALYTICS-CONTRACT.md é executável, não só documental: SCHEMA
 * abaixo é a lista de eventos e campos permitidos, e o gate em
 * scripts/check-site.py falha se a tabela do contrato e este objeto divergirem.
 * Um evento fora da lista é descartado; um campo fora da lista é removido antes
 * de qualquer coisa sair daqui.
 *
 * Nada é transmitido. Os eventos vão para `dataLayer`, para um `CustomEvent`
 * por nome e para um buffer de sessão em memória. Conectar um provedor externo
 * exige o gate humano descrito no contrato — por isso não há fetch, beacon nem
 * URL neste arquivo, e o validador reprova se aparecerem.
 */

(() => {
  "use strict";

  // Campos aceitos em qualquer evento, preenchidos por esta camada.
  const BASE_FIELDS = ["version", "route"];

  // Evento -> campos próprios permitidos. Espelha a tabela do contrato.
  const SCHEMA = {
    page_view: ["referrer_host"],
    sample_download: ["href"],
    kit_access: ["href"],
    kit_download: ["href"],
    readiness_start: [],
    readiness_complete: ["readiness_band"],
    services_view: ["href"],
    services_after_readiness: ["href"],
    interviews_view: ["href"],
    fit_conversation_email: [],
    purchase_click: ["format", "channel"],
    flipbook_open: ["mode"],
    flipbook_page_view: ["page", "mode"],
    flipbook_turn: ["direction", "method"],
    flipbook_bookmark: ["page", "action"],
    flipbook_mark: ["page", "color", "action"],
    flipbook_search: ["hits", "pages", "term_band"],
    flipbook_marks_export: ["marks", "bookmarks"],
    flipbook_setting: ["setting", "state"],
    flipbook_reading_summary: ["pages_seen", "deepest_page", "duration_band", "marks", "bookmarks"],
  };

  const OPT_OUT_KEY = "book:analytics-optout";
  const MAX_BUFFER = 300;
  const MAX_STRING = 64;

  const version = document.querySelector('meta[name="book-version"]')?.content || "unknown";
  const buffer = [];
  const sinks = new Set();

  // Do Not Track e Global Privacy Control desligam a medição e não podem ser
  // sobrepostos pelo controle da página: um sinal do navegador vale mais que
  // uma preferência nossa.
  function browserOptOut() {
    return (
      navigator.doNotTrack === "1" ||
      window.doNotTrack === "1" ||
      navigator.msDoNotTrack === "1" ||
      navigator.globalPrivacyControl === true
    );
  }

  function storedOptOut() {
    try {
      return localStorage.getItem(OPT_OUT_KEY) === "1";
    } catch {
      return false;
    }
  }

  const isEnabled = () => !browserOptOut() && !storedOptOut();

  // Só escalares curtos passam. Isso é o que impede que um objeto com o texto
  // de um trecho marcado ou o termo digitado na busca vaze por descuido.
  function cleanValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.length > MAX_STRING ? trimmed.slice(0, MAX_STRING) : trimmed;
  }

  // O referrer entra só como host: o caminho e a query podem carregar termo de
  // busca, identificador de campanha ou dado de terceiro.
  function referrerHost() {
    if (!document.referrer) return null;
    try {
      const url = new URL(document.referrer);
      return url.host === window.location.host ? "same-site" : url.host;
    } catch {
      return null;
    }
  }

  function track(name, fields = {}) {
    const allowed = SCHEMA[name];
    if (!allowed) return null; // evento fora do contrato: descartado
    if (!isEnabled()) return null;

    const event = { event: name, version, route: window.location.pathname };
    for (const key of allowed) {
      if (!(key in fields)) continue;
      const value = cleanValue(fields[key]);
      if (value !== null) event[key] = value;
    }

    buffer.push({ ...event, at: new Date().toISOString() });
    if (buffer.length > MAX_BUFFER) buffer.shift();

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
    window.dispatchEvent(new CustomEvent(`book:${name}`, { detail: event }));
    // Ponto de conexão para um provedor, depois do gate humano do contrato.
    for (const sink of sinks) {
      try {
        sink(event);
      } catch {
        /* um consumidor com defeito não derruba a página */
      }
    }
    return event;
  }

  function setOptOut(value) {
    try {
      if (value) localStorage.setItem(OPT_OUT_KEY, "1");
      else localStorage.removeItem(OPT_OUT_KEY);
    } catch {
      /* modo privado: a escolha vale só para esta sessão */
    }
    if (value) buffer.length = 0;
    window.dispatchEvent(new CustomEvent("book:analytics-consent", { detail: { enabled: isEnabled() } }));
    return isEnabled();
  }

  // Agregado do que foi coletado nesta sessão, para inspeção pelo próprio leitor.
  function snapshot() {
    const counts = {};
    for (const item of buffer) counts[item.event] = (counts[item.event] || 0) + 1;
    return {
      enabled: isEnabled(),
      browser_signal: browserOptOut(),
      version,
      events: buffer.length,
      counts,
      contract: Object.keys(SCHEMA).sort(),
    };
  }

  window.bookAnalytics = {
    schema: SCHEMA,
    baseFields: BASE_FIELDS,
    track,
    isEnabled,
    optOut: () => setOptOut(true),
    optIn: () => setOptOut(false),
    snapshot,
    events: () => buffer.map((item) => ({ ...item })),
    connect: (sink) => {
      if (typeof sink === "function") sinks.add(sink);
      return () => sinks.delete(sink);
    },
  };

  // Nome histórico, mantido para os scripts embutidos das rotas internas.
  window.bookTrack = track;

  track("page_view", { referrer_host: referrerHost() });

  document.querySelectorAll("[data-event]").forEach((element) => {
    element.addEventListener("click", () => {
      track(element.dataset.event, { href: element.getAttribute("href") });
    });
  });
})();
