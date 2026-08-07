/* Leitor flipbook — O Custo Invisível do Olho Seco (amostra v2.9.45).
 *
 * O manifesto `livro.json` é gerado por scripts/build-flipbook.mjs a partir do
 * PDF verificado em release.json. Cada página é uma imagem; a seleção de texto,
 * o marcador e a busca vivem sobre a camada de palavras de `palavras.json`.
 *
 * Modelo de folhas: uma folha tem frente e verso. Em página dupla a folha i
 * carrega as páginas 2i+1 e 2i+2 e gira em torno da lombada; em página única
 * cada página é a frente de uma folha com verso em branco. `state.index` conta
 * quantas folhas já foram viradas — é a única fonte de verdade da navegação.
 */

(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const dom = {
    body: document.body,
    stage: $("#stage"),
    status: $("[data-status]"),
    statusText: $("[data-status-text]"),
    frame: $("[data-frame]"),
    book: $("[data-book]"),
    leaves: $("[data-leaves]"),
    foot: $("[data-foot]"),
    scrub: $("[data-scrub]"),
    ticks: $("[data-ticks]"),
    indicator: $("[data-page-indicator]"),
    pageLabel: $("[data-page-label]"),
    announce: $("[data-announce]"),
    panel: $("#painel"),
    panelTitle: $("[data-panel-title]"),
    thumbs: $("[data-thumbs]"),
    bookmarks: $("[data-bookmarks]"),
    marks: $("[data-marks]"),
    marksBadge: $('[data-count="marks"]'),
    searchForm: $("[data-search-form]"),
    searchInput: $("[data-search-input]"),
    searchSummary: $("[data-search-summary]"),
    searchResults: $("[data-search-results]"),
    marker: $("[data-marker]"),
    toast: $("[data-toast]"),
  };

  const PANEL_TITLES = { indice: "Índice", marcacoes: "Marcações", busca: "Buscar no texto" };
  const MARK_COLORS = { citrino: "#d8bc7a", ciano: "#72f1e9", coral: "#ff8c71" };
  const GRIP_RATIO = 0.22; // fração da largura da página que funciona como "canto" de virada
  const COMMIT_AT = 0.3; // fração da virada a partir da qual soltar completa o movimento

  let book = null; // manifesto leve
  let wordLayer = null; // camada de palavras, carregada em segundo plano
  let leafModel = []; // [{ front, back }]
  let leafNodes = [];
  const offsetCache = new Map(); // página -> deslocamentos de caractere por palavra

  const state = {
    mode: "double",
    modeLocked: false,
    index: 0,
    sound: true,
    turning: false,
    pageWidth: 0,
    pageHeight: 0,
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarse = window.matchMedia("(pointer: coarse)");

  /* ---------------------------------------------------------------- estado */

  const store = {
    ns: "flipbook:v2.9.45:",
    read(key, fallback) {
      try {
        const raw = localStorage.getItem(this.ns + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(this.ns + key, JSON.stringify(value));
      } catch {
        /* modo privado ou cota cheia: a leitura segue, só não persiste */
      }
    },
  };

  let marks = store.read("marks", []);
  let bookmarks = store.read("bookmarks", []);

  const persistMarks = () => {
    store.write("marks", marks);
    dom.marksBadge.textContent = String(marks.length);
    dom.marksBadge.hidden = marks.length === 0;
  };
  const persistBookmarks = () => store.write("bookmarks", bookmarks);

  /* ----------------------------------------------------------------- áudio */

  // O som de virada é sintetizado: um ruído filtrado com varredura de banda
  // soa como papel e evita carregar um arquivo de áudio só para isso.
  const audio = {
    ctx: null,
    ensure() {
      if (!state.sound) return null;
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return this.ctx;
    },
    noise(ctx, seconds) {
      const frames = Math.ceil(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1) {
        // ruído rosa aproximado: o ruído branco puro soa metálico demais
        data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 0.35;
      }
      return buffer;
    },
    page(direction = 1) {
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const length = 0.42;
      const source = ctx.createBufferSource();
      source.buffer = this.noise(ctx, length);

      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 0.9;
      const from = direction > 0 ? 780 : 1500;
      const to = direction > 0 ? 2600 : 900;
      band.frequency.setValueAtTime(from, now);
      band.frequency.exponentialRampToValueAtTime(to, now + length * 0.8);

      const shelf = ctx.createBiquadFilter();
      shelf.type = "highpass";
      shelf.frequency.value = 420;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.06, now + length * 0.55);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

      source.connect(band).connect(shelf).connect(gain).connect(ctx.destination);
      source.start(now);
      source.stop(now + length);

      // batida grave de quando a folha assenta do outro lado
      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = "sine";
      thump.frequency.setValueAtTime(148, now + length * 0.62);
      thump.frequency.exponentialRampToValueAtTime(62, now + length);
      thumpGain.gain.setValueAtTime(0.0001, now + length * 0.62);
      thumpGain.gain.exponentialRampToValueAtTime(0.05, now + length * 0.7);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + length + 0.06);
      thump.connect(thumpGain).connect(ctx.destination);
      thump.start(now + length * 0.62);
      thump.stop(now + length + 0.08);
    },
    click(pitch = 880) {
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    },
  };

  /* ------------------------------------------------------- modelo de folhas */

  function buildLeafModel() {
    const total = book.page_count;
    leafModel = [];
    if (state.mode === "double") {
      for (let page = 1; page <= total; page += 2) {
        leafModel.push({ front: page, back: page + 1 <= total ? page + 1 : null });
      }
    } else {
      for (let page = 1; page <= total; page += 1) leafModel.push({ front: page, back: null });
    }
  }

  const leftPage = () => (state.mode === "double" ? leafModel[state.index - 1]?.back ?? null : null);
  const rightPage = () => leafModel[state.index]?.front ?? null;
  const visiblePages = () => [leftPage(), rightPage()].filter(Boolean);
  const primaryPage = () => rightPage() ?? leftPage() ?? 1;

  function indexForPage(page) {
    if (state.mode === "single") return clamp(page - 1, 0, leafModel.length - 1);
    return page % 2 === 1 ? (page - 1) / 2 : page / 2;
  }

  /* ------------------------------------------------------------ construção */

  function pageData(number) {
    return book.pages[number - 1];
  }

  function buildFace(kind, number) {
    const face = document.createElement("div");
    face.className = `leaf__face leaf__face--${kind}`;
    if (!number) {
      face.classList.add("leaf__face--blank");
      return face;
    }
    face.dataset.page = String(number);
    const img = document.createElement("img");
    img.width = book.page.width;
    img.height = book.page.height;
    img.alt = `Página ${number} da amostra — ${pageData(number).label}`;
    img.decoding = "async";
    img.draggable = false;
    face.append(img);

    const marklayer = document.createElement("div");
    marklayer.className = "marklayer";
    const number_ = document.createElement("span");
    number_.className = "leaf__number";
    number_.textContent = String(number);
    const grip = document.createElement("div");
    grip.className = "leaf__grip";
    grip.style.cssText = `position:absolute;top:0;bottom:0;z-index:7;width:${GRIP_RATIO * 100}%;cursor:grab;${
      kind === "front" ? "right:0" : "left:0"
    }`;
    face.append(marklayer, number_, grip);
    return face;
  }

  function buildLeaves() {
    buildLeafModel();
    dom.leaves.textContent = "";
    leafNodes = leafModel.map((leaf, i) => {
      const node = document.createElement("div");
      node.className = "leaf";
      node.dataset.leaf = String(i);
      node.append(buildFace("front", leaf.front), buildFace("back", leaf.back));
      dom.leaves.append(node);
      return node;
    });
    dom.book.dataset.mode = state.mode;
    state.index = clamp(state.index, 0, leafModel.length);
  }

  // Só as folhas próximas recebem `src`: 30 páginas de uma vez seriam 5 MB de
  // imagem para exibir duas.
  function loadNearbyImages() {
    const window_ = state.mode === "double" ? 2 : 3;
    leafNodes.forEach((node, i) => {
      const near = Math.abs(i - state.index) <= window_;
      $$(".leaf__face[data-page]", node).forEach((face) => {
        const img = $("img", face);
        if (!img) return;
        const src = pageData(Number(face.dataset.page)).src;
        if (near && img.getAttribute("src") !== src) img.src = src;
      });
    });
  }

  // Deslize de centralização: recebe o índice de destino para acompanhar a
  // virada em vez de acontecer depois dela.
  function updateEdge(index) {
    dom.book.dataset.edge = index === 0 ? "start" : index >= leafModel.length ? "end" : "";
  }

  function applyStack() {
    const total = leafNodes.length;
    leafNodes.forEach((node, i) => {
      const flipped = i < state.index;
      if (!node.classList.contains("is-animating")) {
        node.style.setProperty("--turn", flipped ? "1" : "0");
      }
      node.style.zIndex = String(flipped ? i + 1 : total - i);
      // só a folha do topo de cada pilha responde ao ponteiro
      node.classList.toggle("is-idle", i !== state.index && i !== state.index - 1);
    });
    dom.book.dataset.open = String(state.index > 0 && state.index < leafModel.length);
    updateEdge(state.index);
  }

  /* --------------------------------------------------- camada de texto/marcas */

  function faceForPage(number) {
    return dom.leaves.querySelector(`.leaf__face[data-page="${number}"]`);
  }

  function mountTextLayer(number) {
    const face = faceForPage(number);
    if (!face || !wordLayer) return;
    const existing = $(".textlayer", face);
    if (existing) return;
    const words = wordLayer[number - 1]?.words;
    if (!words?.length) return;

    const layer = document.createElement("div");
    layer.className = "textlayer";
    layer.dataset.page = String(number);
    // fins de linha, para separar as palavras no texto copiado pelo navegador
    const breaks = new Set((wordLayer[number - 1].lines ?? []).map(([, end]) => end));
    const spans = words.map((word, i) => {
      const span = document.createElement("span");
      span.dataset.w = String(i);
      span.textContent = word.t;
      span.style.left = `${word.x * 100}%`;
      span.style.top = `${word.y * 100}%`;
      span.style.fontSize = `${word.h * state.pageHeight}px`;
      layer.append(span);
      // nós de texto fora de fluxo visível: só existem para o Range.toString()
      layer.append(document.createTextNode(breaks.has(i) ? "\n" : " "));
      return span;
    });
    face.append(layer);

    // leituras em bloco e escritas em bloco: um refluxo em vez de um por palavra
    const natural = spans.map((span) => span.offsetWidth);
    spans.forEach((span, i) => {
      const target = words[i].w * state.pageWidth;
      if (natural[i] > 0) span.style.transform = `scaleX(${(target / natural[i]).toFixed(4)})`;
    });
  }

  function resizeTextLayers() {
    $$(".textlayer").forEach((layer) => {
      const page = Number(layer.dataset.page);
      layer.remove();
      mountTextLayer(page);
    });
  }

  // Um trecho marcado pode cruzar várias linhas: cada linha vira um retângulo.
  function markRects(number, from, to) {
    const page = wordLayer?.[number - 1];
    if (!page) return [];
    const rects = [];
    for (const [start, end] of page.lines) {
      const a = Math.max(start, from);
      const b = Math.min(end, to);
      if (a > b) continue;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = a; i <= b; i += 1) {
        const word = page.words[i];
        x0 = Math.min(x0, word.x);
        y0 = Math.min(y0, word.y);
        x1 = Math.max(x1, word.x + word.w);
        y1 = Math.max(y1, word.y + word.h);
      }
      rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    return rects;
  }

  function renderMarks(number, hits = []) {
    const face = faceForPage(number);
    if (!face) return;
    const layer = $(".marklayer", face);
    if (!layer) return;
    layer.textContent = "";
    const draw = (rect, color, hit) => {
      const el = document.createElement("i");
      el.style.left = `${rect.x * 100}%`;
      el.style.top = `${rect.y * 100}%`;
      el.style.width = `${rect.w * 100}%`;
      el.style.height = `${rect.h * 100}%`;
      el.style.setProperty("--mark-color", color);
      if (hit) el.dataset.hit = "true";
      layer.append(el);
    };
    for (const mark of marks.filter((item) => item.page === number)) {
      for (const rect of markRects(number, mark.from, mark.to)) {
        draw(rect, MARK_COLORS[mark.color] || MARK_COLORS.citrino, false);
      }
    }
    for (const hit of hits) {
      for (const rect of markRects(number, hit.from, hit.to)) draw(rect, MARK_COLORS.ciano, true);
    }
  }

  function renderRibbons() {
    $$(".leaf__ribbon").forEach((node) => node.remove());
    for (const number of visiblePages()) {
      if (!bookmarks.includes(number)) continue;
      const face = faceForPage(number);
      if (!face) continue;
      const ribbon = document.createElement("span");
      ribbon.className = "leaf__ribbon";
      face.append(ribbon);
    }
  }

  /* ----------------------------------------------------------- apresentação */

  function layout() {
    if (!book) return;
    // abaixo de 700px o controle de página dupla nem aparece: a escolha do
    // leitor não pode prender o livro num formato que não cabe na tela
    if (dom.stage.clientWidth < 700) {
      state.mode = "single";
    } else if (!state.modeLocked) {
      const wide = dom.stage.clientWidth / Math.max(dom.stage.clientHeight, 1) > 1.05;
      state.mode = wide ? "double" : "single";
    }
    const cols = state.mode === "double" ? 2 : 1;
    if (dom.book.dataset.mode !== state.mode) rebuild();

    const styles = getComputedStyle(dom.stage);
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const availableWidth = Math.max(dom.stage.clientWidth - padX - 96, 220);
    const availableHeight = Math.max(dom.stage.clientHeight - padY - 24, 220);

    let height = availableHeight;
    let width = height * book.page.aspect;
    if (width * cols > availableWidth) {
      width = availableWidth / cols;
      height = width / book.page.aspect;
    }
    state.pageWidth = Math.round(width);
    state.pageHeight = Math.round(height);
    dom.frame.style.setProperty("--pw", `${state.pageWidth}px`);
    dom.frame.style.setProperty("--ph", `${state.pageHeight}px`);
    dom.frame.style.setProperty("--cols", String(cols));
    $("[data-action='spread'] .tool__label").textContent =
      state.mode === "double" ? "Página dupla" : "Página única";
  }

  function rebuild() {
    const page = primaryPage();
    buildLeaves();
    state.index = indexForPage(page);
    applyStack();
    loadNearbyImages();
  }

  function render({ announce = true } = {}) {
    applyStack();
    loadNearbyImages();
    renderRibbons();
    for (const number of visiblePages()) {
      mountTextLayer(number);
      renderMarks(number);
    }

    const pages = visiblePages();
    const label = pageData(primaryPage()).label;
    const shown = pages.length === 2 ? `Páginas ${pages[0]}–${pages[1]}` : `Página ${pages[0] ?? 1}`;
    dom.indicator.textContent = `${shown} de ${book.page_count}`;
    dom.pageLabel.textContent = label;
    dom.scrub.value = String(primaryPage());
    dom.scrub.style.setProperty(
      "--progress",
      `${((primaryPage() - 1) / Math.max(book.page_count - 1, 1)) * 100}%`
    );

    $("[data-action='prev']").disabled = state.index === 0;
    $("[data-action='next']").disabled = state.index >= leafModel.length;
    const marked = pages.some((page) => bookmarks.includes(page));
    $("[data-action='bookmark']").setAttribute("aria-pressed", String(marked));

    if (announce) dom.announce.textContent = `${shown} de ${book.page_count}. ${label}`;
    $$(".thumb").forEach((thumb) => {
      thumb.setAttribute("aria-current", String(pages.includes(Number(thumb.dataset.page))));
    });
    store.write("position", { page: primaryPage() });
  }

  /* ---------------------------------------------------------------- virada */

  function animateLeaf(node, target, done) {
    node.classList.add("is-animating");
    // força um quadro antes de mudar --turn para a transição realmente ocorrer
    void node.offsetWidth;
    node.style.setProperty("--turn", String(target));
    const ms = reduceMotion.matches
      ? 1
      : parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--turn-ms")) || 720;
    window.setTimeout(() => {
      node.classList.remove("is-animating");
      done?.();
    }, ms + 20);
  }

  function turn(direction, { silent = false } = {}) {
    if (state.turning) return false;
    const forward = direction > 0;
    const leafIndex = forward ? state.index : state.index - 1;
    const node = leafNodes[leafIndex];
    if (!node) return false;

    state.turning = true;
    if (!silent) audio.page(direction);
    // a folha em movimento precisa passar por cima das duas pilhas
    node.style.zIndex = String(leafNodes.length + 2);
    const destination = state.index + (forward ? 1 : -1);
    loadNearbyImagesFor(destination);
    updateEdge(destination);

    animateLeaf(node, forward ? 1 : 0, () => {
      state.index += forward ? 1 : -1;
      state.turning = false;
      render();
    });
    return true;
  }

  function loadNearbyImagesFor(index) {
    const previous = state.index;
    state.index = clamp(index, 0, leafModel.length);
    loadNearbyImages();
    state.index = previous;
  }

  function goToPage(page, { silent = false } = {}) {
    const target = clamp(Number(page) || 1, 1, book.page_count);
    const index = indexForPage(target);
    if (index === state.index) {
      render();
      return;
    }
    const distance = Math.abs(index - state.index);
    if (distance === 1) {
      turn(index > state.index ? 1 : -1, { silent });
      return;
    }
    // salto longo: sem animação folha a folha, mas com o som de virada
    if (!silent) audio.page(index > state.index ? 1 : -1);
    state.index = index;
    render();
  }

  /* --------------------------------------------------------- arrastar folha */

  const drag = {
    active: false,
    provisional: false,
    node: null,
    forward: true,
    startX: 0,
    startY: 0,
    pointerId: null,
  };

  function beginDrag(event) {
    if (state.turning || !book) return;
    if (event.button !== undefined && event.button !== 0) return;
    const onGrip = event.target.closest?.(".leaf__grip");
    if (!onGrip && !coarse.matches) return;

    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.pointerId = event.pointerId;
    drag.node = null;
    drag.active = false;
    drag.provisional = true;
    dom.frame.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!drag.provisional && !drag.active) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.provisional) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return; // gesto ainda ambíguo
      const forward = dx < 0;
      const index = forward ? state.index : state.index - 1;
      const node = leafNodes[index];
      if (!node) {
        drag.provisional = false;
        return;
      }
      drag.provisional = false;
      drag.active = true;
      drag.forward = forward;
      drag.node = node;
      node.classList.remove("is-animating");
      node.style.zIndex = String(leafNodes.length + 2);
      loadNearbyImagesFor(forward ? state.index + 1 : state.index - 1);
      window.getSelection()?.removeAllRanges();
      hideMarker();
    }

    event.preventDefault();
    const travel = clamp(Math.abs(dx) / Math.max(state.pageWidth, 1), 0, 1);
    drag.node.style.setProperty("--turn", String(drag.forward ? travel : 1 - travel));
  }

  function endDrag() {
    if (drag.provisional) drag.provisional = false;
    if (!drag.active) return;
    const node = drag.node;
    const forward = drag.forward;
    const travel = parseFloat(node.style.getPropertyValue("--turn")) || 0;
    const progress = forward ? travel : 1 - travel;
    drag.active = false;
    drag.node = null;
    state.turning = true;

    if (progress > COMMIT_AT) {
      audio.page(forward ? 1 : -1);
      updateEdge(state.index + (forward ? 1 : -1));
      animateLeaf(node, forward ? 1 : 0, () => {
        state.index += forward ? 1 : -1;
        state.turning = false;
        render();
      });
    } else {
      animateLeaf(node, forward ? 0 : 1, () => {
        state.turning = false;
        render({ announce: false });
      });
    }
  }

  /* ------------------------------------------------- marcador de texto (UI) */

  // Em vez de olhar só as pontas da seleção — que podem cair nos separadores —,
  // coleta toda palavra que o intervalo cruza. Seleção entre páginas é ignorada.
  function currentSelectionRange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const layer = element?.closest?.(".textlayer");
    if (!layer) return null;
    const indices = [...layer.children]
      .filter((span) => span.dataset.w !== undefined && range.intersectsNode(span))
      .map((span) => Number(span.dataset.w));
    if (!indices.length) return null;
    return {
      page: Number(layer.dataset.page),
      from: Math.min(...indices),
      to: Math.max(...indices),
      rect: range.getBoundingClientRect(),
    };
  }

  let pendingSelection = null;

  function showMarker(range) {
    pendingSelection = range;
    const overlapping = marks.find(
      (mark) => mark.page === range.page && mark.from <= range.to && mark.to >= range.from
    );
    $('[data-mark-action="remove"]').hidden = !overlapping;
    dom.marker.hidden = false;
    const left = clamp(range.rect.left + range.rect.width / 2, 90, window.innerWidth - 90);
    dom.marker.style.left = `${left}px`;
    dom.marker.style.top = `${Math.max(range.rect.top - 10, 56)}px`;
  }

  function hideMarker() {
    dom.marker.hidden = true;
    pendingSelection = null;
  }

  function selectionText(page, from, to) {
    const words = wordLayer?.[page - 1]?.words ?? [];
    return words.slice(from, to + 1).map((word) => word.t).join(" ");
  }

  function addMark(color) {
    if (!pendingSelection) return;
    const { page, from, to } = pendingSelection;
    // funde marcações que se sobrepõem em vez de empilhar retângulos
    const overlapping = marks.filter((mark) => mark.page === page && mark.from <= to && mark.to >= from);
    const merged = {
      id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      page,
      from: Math.min(from, ...overlapping.map((mark) => mark.from)),
      to: Math.max(to, ...overlapping.map((mark) => mark.to)),
      color,
      at: new Date().toISOString(),
    };
    merged.text = selectionText(page, merged.from, merged.to);
    marks = marks.filter((mark) => !overlapping.includes(mark)).concat(merged);
    marks.sort((a, b) => a.page - b.page || a.from - b.from);
    persistMarks();
    renderMarks(page);
    renderMarkList();
    window.getSelection()?.removeAllRanges();
    hideMarker();
    audio.click(1180);
    toast("Trecho marcado");
  }

  function removeMarkAt(page, from, to) {
    const before = marks.length;
    marks = marks.filter((mark) => !(mark.page === page && mark.from <= to && mark.to >= from));
    if (marks.length === before) return;
    persistMarks();
    renderMarks(page);
    renderMarkList();
    window.getSelection()?.removeAllRanges();
    hideMarker();
    audio.click(520);
    toast("Marcação removida");
  }

  /* -------------------------------------------------- marcador de página (UI) */

  function toggleBookmark(page = primaryPage()) {
    const index = bookmarks.indexOf(page);
    if (index > -1) {
      bookmarks.splice(index, 1);
      audio.click(520);
      toast(`Marcador retirado da página ${page}`);
    } else {
      bookmarks.push(page);
      bookmarks.sort((a, b) => a - b);
      audio.click(1320);
      toast(`Página ${page} marcada`);
    }
    persistBookmarks();
    renderRibbons();
    renderBookmarkList();
    renderTicks();
    render({ announce: false });
  }

  function renderTicks() {
    dom.ticks.textContent = "";
    for (const page of bookmarks) {
      const tick = document.createElement("b");
      tick.style.left = `${((page - 1) / Math.max(book.page_count - 1, 1)) * 100}%`;
      dom.ticks.append(tick);
    }
  }

  /* ---------------------------------------------------------------- painéis */

  function entry({ accent, title, body, page, onRemove }) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "entry";
    node.style.setProperty("--accent", accent);
    node.dataset.page = String(page);
    const heading = document.createElement("b");
    heading.textContent = title;
    node.append(heading);
    if (body) node.append(body);
    node.addEventListener("click", () => {
      goToPage(page);
      if (window.innerWidth < 760) closePanel();
    });
    if (onRemove) {
      const drop = document.createElement("span");
      drop.className = "entry__drop";
      drop.setAttribute("role", "button");
      drop.tabIndex = 0;
      drop.title = "Remover";
      drop.textContent = "×";
      const fire = (event) => {
        event.stopPropagation();
        onRemove();
      };
      drop.addEventListener("click", fire);
      drop.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") fire(event);
      });
      node.append(drop);
    }
    return node;
  }

  function empty(message) {
    const node = document.createElement("p");
    node.className = "panel__empty";
    node.textContent = message;
    return node;
  }

  function renderThumbs() {
    dom.thumbs.textContent = "";
    for (const page of book.pages) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumb";
      button.dataset.page = String(page.n);
      button.title = page.label;
      const img = document.createElement("img");
      img.src = page.thumb;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      const caption = document.createElement("span");
      caption.textContent = String(page.n);
      button.append(img, caption);
      button.addEventListener("click", () => {
        goToPage(page.n);
        if (window.innerWidth < 760) closePanel();
      });
      dom.thumbs.append(button);
    }
  }

  function renderBookmarkList() {
    dom.bookmarks.textContent = "";
    if (!bookmarks.length) {
      dom.bookmarks.append(empty("Nenhuma página marcada ainda. Use o botão “Marcar página” ou a tecla B."));
      return;
    }
    for (const page of bookmarks) {
      const body = document.createElement("span");
      body.textContent = pageData(page).label;
      dom.bookmarks.append(
        entry({
          accent: MARK_COLORS.coral,
          title: `Página ${page}`,
          body,
          page,
          onRemove: () => toggleBookmark(page),
        })
      );
    }
  }

  function renderMarkList() {
    dom.marks.textContent = "";
    if (!marks.length) {
      dom.marks.append(empty("Selecione um trecho na página para marcá-lo."));
      return;
    }
    for (const mark of marks) {
      const quote = document.createElement("q");
      quote.textContent = mark.text.length > 220 ? `${mark.text.slice(0, 220)}…` : mark.text;
      dom.marks.append(
        entry({
          accent: MARK_COLORS[mark.color] || MARK_COLORS.citrino,
          title: `Página ${mark.page}`,
          body: quote,
          page: mark.page,
          onRemove: () => removeMarkAt(mark.page, mark.from, mark.to),
        })
      );
    }
  }

  function openPanel(view) {
    dom.body.dataset.panel = view;
    dom.panel.hidden = false;
    dom.panelTitle.textContent = PANEL_TITLES[view] ?? "Painel";
    $$("[data-view]").forEach((section) => {
      section.hidden = section.dataset.view !== view;
    });
    $$("[data-panel-toggle]").forEach((button) => {
      button.setAttribute("aria-expanded", String(button.dataset.panelToggle === view));
    });
    if (view === "busca") dom.searchInput.focus();
    window.requestAnimationFrame(layout);
  }

  function closePanel() {
    dom.body.dataset.panel = "";
    dom.panel.hidden = true;
    $$("[data-panel-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
    window.requestAnimationFrame(layout);
  }

  function togglePanel(view) {
    if (dom.body.dataset.panel === view) closePanel();
    else openPanel(view);
  }

  /* ------------------------------------------------------------------ busca */

  const fold = (value) =>
    value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");

  // Mapeia deslocamento de caractere em `page.text` de volta para o índice da
  // palavra, já que o texto plano é a junção das palavras por espaço.
  function wordOffsets(page) {
    if (offsetCache.has(page)) return offsetCache.get(page);
    const words = wordLayer?.[page - 1]?.words ?? [];
    const offsets = [];
    let cursor = 0;
    for (const word of words) {
      offsets.push(cursor);
      cursor += word.t.length + 1;
    }
    offsetCache.set(page, offsets);
    return offsets;
  }

  function wordRangeAt(page, start, length) {
    const offsets = wordOffsets(page);
    if (!offsets.length) return null;
    let from = 0;
    while (from + 1 < offsets.length && offsets[from + 1] <= start) from += 1;
    let to = from;
    while (to + 1 < offsets.length && offsets[to + 1] < start + length) to += 1;
    return { from, to };
  }

  let searchHits = [];

  function runSearch(query) {
    dom.searchResults.textContent = "";
    searchHits = [];
    const needle = fold(query.trim());
    if (needle.length < 2) {
      dom.searchSummary.textContent = "Digite ao menos duas letras para buscar nas 30 páginas.";
      return;
    }
    for (const page of book.pages) {
      const haystack = fold(page.text);
      let at = haystack.indexOf(needle);
      while (at > -1 && searchHits.length < 120) {
        searchHits.push({ page: page.n, at, length: needle.length });
        at = haystack.indexOf(needle, at + needle.length);
      }
    }
    const count = searchHits.length;
    dom.searchSummary.textContent = count
      ? `${count} ocorrência${count > 1 ? "s" : ""} em ${new Set(searchHits.map((hit) => hit.page)).size} página(s).`
      : "Nenhuma ocorrência nesta amostra de 30 páginas.";

    for (const hit of searchHits) {
      const text = pageData(hit.page).text;
      const from = Math.max(0, hit.at - 55);
      const to = Math.min(text.length, hit.at + hit.length + 65);
      const body = document.createElement("span");
      if (from > 0) body.append("…");
      body.append(text.slice(from, hit.at));
      const strong = document.createElement("mark");
      strong.textContent = text.slice(hit.at, hit.at + hit.length);
      body.append(strong, text.slice(hit.at + hit.length, to));
      if (to < text.length) body.append("…");
      const node = entry({
        accent: MARK_COLORS.ciano,
        title: `Página ${hit.page}`,
        body,
        page: hit.page,
      });
      node.addEventListener("click", () => {
        window.setTimeout(() => {
          const range = wordRangeAt(hit.page, hit.at, hit.length);
          if (!range) return;
          renderMarks(hit.page, [range]);
          window.setTimeout(() => renderMarks(hit.page), 3200);
        }, 260);
      });
      dom.searchResults.append(node);
    }
  }

  /* ---------------------------------------------------------------- avisos */

  let toastTimer = 0;
  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 2200);
  }

  function exportMarks() {
    if (!marks.length && !bookmarks.length) {
      toast("Nada marcado para exportar");
      return;
    }
    const lines = [
      `# Marcações — ${book.title}`,
      "",
      `Edição ${book.edition} · amostra de ${book.page_count} páginas`,
      `Exportado em ${new Date().toLocaleString("pt-BR")}`,
      "",
    ];
    if (bookmarks.length) {
      lines.push("## Páginas marcadas", "");
      for (const page of bookmarks) lines.push(`- Página ${page} — ${pageData(page).label}`);
      lines.push("");
    }
    if (marks.length) {
      lines.push("## Trechos marcados", "");
      for (const mark of marks) {
        lines.push(`### Página ${mark.page} — ${pageData(mark.page).label}`, "", `> ${mark.text}`, "");
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `marcacoes-olho-seco-${book.edition}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Marcações exportadas");
  }

  /* ---------------------------------------------------------------- eventos */

  function bindEvents() {
    $("[data-action='prev']").addEventListener("click", () => turn(-1));
    $("[data-action='next']").addEventListener("click", () => turn(1));

    $("[data-action='bookmark']").addEventListener("click", () => toggleBookmark());

    $("[data-action='spread']").addEventListener("click", () => {
      state.modeLocked = true;
      state.mode = state.mode === "double" ? "single" : "double";
      layout();
      rebuild();
      resizeTextLayers();
      render();
      store.write("mode", state.mode);
      audio.click(760);
    });

    const soundButton = $("[data-action='sound']");
    soundButton.addEventListener("click", () => {
      state.sound = !state.sound;
      soundButton.setAttribute("aria-pressed", String(state.sound));
      store.write("sound", state.sound);
      if (state.sound) audio.click(980);
      toast(state.sound ? "Som ligado" : "Som desligado");
    });

    const fullscreenButton = $("[data-action='fullscreen']");
    fullscreenButton.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => toast("Tela cheia indisponível"));
    });
    document.addEventListener("fullscreenchange", () => {
      fullscreenButton.setAttribute("aria-pressed", String(Boolean(document.fullscreenElement)));
      window.requestAnimationFrame(layout);
    });

    $$("[data-panel-toggle]").forEach((button) => {
      button.addEventListener("click", () => togglePanel(button.dataset.panelToggle));
    });
    $("[data-action='close-panel']").addEventListener("click", closePanel);
    $("[data-action='export-marks']").addEventListener("click", exportMarks);
    $("[data-action='clear-marks']").addEventListener("click", () => {
      if (!marks.length && !bookmarks.length) return;
      marks = [];
      bookmarks = [];
      persistMarks();
      persistBookmarks();
      renderMarkList();
      renderBookmarkList();
      renderTicks();
      visiblePages().forEach((page) => renderMarks(page));
      renderRibbons();
      render({ announce: false });
      toast("Marcações apagadas");
    });

    dom.scrub.addEventListener("input", () => {
      const page = Number(dom.scrub.value);
      dom.indicator.textContent = `Página ${page} de ${book.page_count}`;
      dom.pageLabel.textContent = pageData(page).label;
      dom.scrub.style.setProperty(
        "--progress",
        `${((page - 1) / Math.max(book.page_count - 1, 1)) * 100}%`
      );
    });
    dom.scrub.addEventListener("change", () => goToPage(Number(dom.scrub.value)));

    dom.searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch(dom.searchInput.value);
    });
    let searchTimer = 0;
    dom.searchInput.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => runSearch(dom.searchInput.value), 220);
    });

    dom.frame.addEventListener("pointerdown", beginDrag);
    dom.frame.addEventListener("pointermove", moveDrag);
    dom.frame.addEventListener("pointerup", endDrag);
    dom.frame.addEventListener("pointercancel", endDrag);

    $$("[data-mark-color]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => addMark(button.dataset.markColor));
    });
    $('[data-mark-action="copy"]').addEventListener("click", () => {
      if (!pendingSelection) return;
      const { page, from, to } = pendingSelection;
      navigator.clipboard?.writeText(selectionText(page, from, to)).then(
        () => toast("Trecho copiado"),
        () => toast("Não foi possível copiar")
      );
      hideMarker();
    });
    $('[data-mark-action="remove"]').addEventListener("click", () => {
      if (!pendingSelection) return;
      const { page, from, to } = pendingSelection;
      removeMarkAt(page, from, to);
    });

    document.addEventListener("selectionchange", () => {
      if (drag.active) return;
      const range = currentSelectionRange();
      if (range) showMarker(range);
      else hideMarker();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!dom.marker.hidden && !dom.marker.contains(event.target)) hideMarker();
    });

    // roda do mouse e trackpad: acumula até um limiar para não virar em cascata
    let wheelLock = 0;
    dom.stage.addEventListener(
      "wheel",
      (event) => {
        if (Math.abs(event.deltaX) < 12 && Math.abs(event.deltaY) < 12) return;
        const now = Date.now();
        if (now < wheelLock) return;
        wheelLock = now + 620;
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        turn(delta > 0 ? 1 : -1);
      },
      { passive: true }
    );

    document.addEventListener("keydown", (event) => {
      const tag = event.target?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable;
      if (event.key === "Escape") {
        if (!dom.marker.hidden) hideMarker();
        else if (dom.body.dataset.panel) closePanel();
        else if (document.fullscreenElement) document.exitFullscreen?.();
        return;
      }
      if (typing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const actions = {
        ArrowLeft: () => turn(-1),
        ArrowRight: () => turn(1),
        PageUp: () => turn(-1),
        PageDown: () => turn(1),
        " ": () => turn(1),
        Home: () => goToPage(1),
        End: () => goToPage(book.page_count),
        b: () => toggleBookmark(),
        m: () => $("[data-action='sound']").click(),
        f: () => $("[data-action='fullscreen']").click(),
        d: () => $("[data-action='spread']").click(),
        t: () => togglePanel("indice"),
        n: () => togglePanel("marcacoes"),
        "/": () => openPanel("busca"),
      };
      const action = actions[event.key] ?? actions[event.key.toLowerCase?.()];
      if (!action) return;
      event.preventDefault();
      action();
    });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        layout();
        resizeTextLayers();
        render({ announce: false });
      }, 140);
    });
  }

  /* ------------------------------------------------------------------- boot */

  function fail(message, hint) {
    dom.status.dataset.status = "error";
    dom.statusText.textContent = message;
    if (hint) {
      const code = document.createElement("code");
      code.textContent = hint;
      dom.statusText.append(document.createElement("br"), code);
    }
  }

  async function boot() {
    let manifest;
    try {
      const response = await fetch("livro.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(String(response.status));
      manifest = await response.json();
    } catch {
      fail(
        "As páginas do flipbook ainda não foram geradas para esta cópia do site.",
        "npm run build:livro"
      );
      return;
    }

    book = manifest;
    state.sound = store.read("sound", true);
    const savedMode = store.read("mode", null);
    if (savedMode === "single" || savedMode === "double") {
      state.mode = savedMode;
      state.modeLocked = true;
    }
    $("[data-action='sound']").setAttribute("aria-pressed", String(state.sound));
    dom.scrub.max = String(book.page_count);

    dom.status.hidden = true;
    dom.frame.hidden = false;
    dom.foot.hidden = false;
    $("[data-action='prev']").hidden = false;
    $("[data-action='next']").hidden = false;

    buildLeaves();
    layout();
    renderThumbs();
    renderBookmarkList();
    renderMarkList();
    renderTicks();
    persistMarks();

    const saved = store.read("position", null);
    if (saved?.page) state.index = indexForPage(clamp(saved.page, 1, book.page_count));
    render({ announce: false });
    bindEvents();

    // a camada de palavras só é necessária para selecionar, marcar e destacar
    // busca: chega depois da primeira página já estar na tela
    try {
      const response = await fetch(book.word_layer ?? "palavras.json", { cache: "no-cache" });
      if (response.ok) {
        const payload = await response.json();
        wordLayer = payload.pages;
        visiblePages().forEach((page) => {
          mountTextLayer(page);
          renderMarks(page);
        });
        // marcações salvas ganham o texto que faltava quando a camada chegou
        let repaired = false;
        for (const mark of marks) {
          if (mark.text) continue;
          mark.text = selectionText(mark.page, mark.from, mark.to);
          repaired = true;
        }
        if (repaired) {
          persistMarks();
          renderMarkList();
        }
      }
    } catch {
      toast("Seleção de texto indisponível nesta sessão");
    }
  }

  boot();
})();
