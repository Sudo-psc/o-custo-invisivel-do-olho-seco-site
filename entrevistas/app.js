(() => {
  "use strict";

  const sets = window.INTERVIEW_SETS;
  const DRAFT_KEY = "ocioso-interview-drafts-v1";
  const COMPLETION_KEY = "ocioso-interview-completions-v1";
  const letters = ["A", "B", "C", "D"];

  const elements = {
    home: document.getElementById("home-screen"),
    survey: document.getElementById("survey-screen"),
    result: document.getElementById("result-screen"),
    homeButton: document.getElementById("home-button"),
    backHome: document.getElementById("back-home"),
    finishHome: document.getElementById("finish-home"),
    clearData: document.getElementById("clear-data"),
    surveyEyebrow: document.getElementById("survey-eyebrow"),
    surveyTitle: document.getElementById("survey-title"),
    surveyDescription: document.getElementById("survey-description"),
    participantCode: document.getElementById("participant-code"),
    participantRole: document.getElementById("participant-role"),
    submissionConsent: document.getElementById("submission-consent"),
    progressText: document.getElementById("progress-text"),
    progressPercent: document.getElementById("progress-percent"),
    progressBar: document.getElementById("progress-bar"),
    questionHost: document.getElementById("question-host"),
    previous: document.getElementById("previous-question"),
    next: document.getElementById("next-question"),
    form: document.getElementById("interview-form"),
    formError: document.getElementById("form-error"),
    draftStatus: document.getElementById("draft-status"),
    resultTitle: document.getElementById("result-title"),
    resultLead: document.getElementById("result-lead"),
    answerPreview: document.getElementById("answer-preview-content"),
    comparisonCard: document.getElementById("comparison-card"),
    downloadText: document.getElementById("download-text"),
    downloadJson: document.getElementById("download-json"),
    copyResult: document.getElementById("copy-result"),
    downloadComparison: document.getElementById("download-comparison"),
    deliveryCard: document.getElementById("delivery-card"),
    deliveryDot: document.getElementById("delivery-dot"),
    deliveryTitle: document.getElementById("delivery-title"),
    deliveryMessage: document.getElementById("delivery-message"),
    retrySubmission: document.getElementById("retry-submission"),
    toast: document.getElementById("toast")
  };

  let state = emptyState();
  let currentCompletion = null;
  let toastTimer = null;

  function emptyState(type = null) {
    return {
      type,
      step: 0,
      participantCode: "",
      participantRole: "",
      consent: false,
      startedAt: new Date().toISOString(),
      answers: {},
      finalComment: ""
    };
  }

  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (_error) {
      return {};
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_error) {
      showToast("Não foi possível salvar neste navegador.");
      return false;
    }
  }

  function normalizeCode(code) {
    return code.trim().toLocaleLowerCase("pt-BR");
  }

  function completionKey(code, type) {
    return `${normalizeCode(code)}::${type}`;
  }

  function showScreen(name) {
    elements.home.hidden = name !== "home";
    elements.survey.hidden = name !== "survey";
    elements.result.hidden = name !== "result";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2800);
  }

  function showError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = false;
  }

  function clearError() {
    elements.formError.hidden = true;
    elements.formError.textContent = "";
  }

  function loadDraft(type) {
    const drafts = readStore(DRAFT_KEY);
    const draft = drafts[type];
    if (!draft || draft.type !== type) return emptyState(type);
    return {
      ...emptyState(type),
      ...draft,
      step: Math.min(Math.max(Number(draft.step) || 0, 0), 8),
      answers: draft.answers || {}
    };
  }

  function saveDraft(announce = false) {
    if (!state.type) return;
    const drafts = readStore(DRAFT_KEY);
    drafts[state.type] = { ...state, savedAt: new Date().toISOString() };
    if (writeStore(DRAFT_KEY, drafts)) {
      elements.draftStatus.textContent = "Rascunho salvo neste navegador";
      if (announce) showToast("Rascunho salvo localmente.");
    }
  }

  function removeDraft(type) {
    const drafts = readStore(DRAFT_KEY);
    delete drafts[type];
    writeStore(DRAFT_KEY, drafts);
  }

  function startInterview(type) {
    if (!sets[type]) return;
    state = loadDraft(type);
    const set = sets[type];
    elements.surveyEyebrow.textContent = set.eyebrow;
    elements.surveyTitle.textContent = set.title;
    elements.surveyDescription.textContent = set.description;
    elements.participantCode.value = state.participantCode;
    elements.participantRole.value = state.participantRole;
    elements.submissionConsent.checked = Boolean(state.consent);
    elements.draftStatus.textContent = state.savedAt ? "Rascunho recuperado" : "Rascunho local";
    showScreen("survey");
    renderStep();
    elements.participantCode.focus({ preventScroll: true });
  }

  function renderStep() {
    clearError();
    const set = sets[state.type];
    const total = set.questions.length;
    const isComment = state.step === total;
    const shownStep = isComment ? total : state.step + 1;
    const percent = isComment ? 100 : Math.round((shownStep / total) * 100);

    elements.progressText.textContent = isComment ? "Comentário opcional" : `Pergunta ${shownStep} de ${total}`;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressBar.style.width = `${percent}%`;
    elements.previous.disabled = state.step === 0;
    elements.next.innerHTML = isComment ? "Concluir entrevista <span aria-hidden=\"true\">✓</span>" : "Continuar <span aria-hidden=\"true\">→</span>";

    if (isComment) {
      renderFinalComment(set);
    } else {
      renderQuestion(set.questions[state.step], state.step, total);
    }
  }

  function renderQuestion(question, index, total) {
    elements.questionHost.replaceChildren();

    const indexLabel = document.createElement("p");
    indexLabel.className = "question-index";
    indexLabel.textContent = `Pergunta ${index + 1} de ${total}`;

    const fieldset = document.createElement("fieldset");
    fieldset.className = "question-fieldset";
    const legend = document.createElement("legend");
    legend.textContent = question.prompt;
    fieldset.appendChild(legend);

    const options = document.createElement("div");
    options.className = "options-list";
    const current = state.answers[question.id];

    question.options.forEach((text, optionIndex) => {
      const letter = letters[optionIndex];
      const label = optionLabel(question.id, letter, text, current?.choice === letter);
      options.appendChild(label);
    });

    const otherWrap = document.createElement("div");
    otherWrap.className = "other-wrap";
    const otherLabel = optionLabel(question.id, "E", "Outros: digite", current?.choice === "E");
    const otherInput = document.createElement("textarea");
    otherInput.className = "other-input";
    otherInput.id = `other-${question.id}`;
    otherInput.placeholder = "Escreva sua resposta com suas próprias palavras.";
    otherInput.maxLength = 800;
    otherInput.value = current?.choice === "E" ? current.text || "" : "";
    otherInput.setAttribute("aria-label", "Outra resposta em texto");
    otherInput.addEventListener("focus", () => {
      const radio = otherLabel.querySelector("input");
      radio.checked = true;
      updateAnswer(question, "E", otherInput.value);
    });
    otherInput.addEventListener("input", () => updateAnswer(question, "E", otherInput.value));
    otherWrap.append(otherLabel, otherInput);
    options.appendChild(otherWrap);

    fieldset.appendChild(options);
    elements.questionHost.append(indexLabel, fieldset);

    options.addEventListener("change", (event) => {
      if (!event.target.matches("input[type='radio']")) return;
      const letter = event.target.value;
      const text = letter === "E" ? otherInput.value : question.options[letters.indexOf(letter)];
      updateAnswer(question, letter, text);
      if (letter === "E") otherInput.focus();
    });

  }

  function optionLabel(questionId, letter, text, checked) {
    const label = document.createElement("label");
    label.className = "option-label";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `question-${questionId}`;
    input.value = letter;
    input.checked = checked;

    const letterSpan = document.createElement("span");
    letterSpan.className = "option-letter";
    letterSpan.textContent = `${letter}.`;

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    label.append(input, letterSpan, textSpan);
    return label;
  }

  function updateAnswer(question, choice, text) {
    state.answers[question.id] = { choice, text: text || "" };
    clearError();
    saveDraft();
  }

  function renderFinalComment(set) {
    elements.questionHost.replaceChildren();
    const wrap = document.createElement("div");
    wrap.className = "final-comment-wrap";

    const indexLabel = document.createElement("p");
    indexLabel.className = "question-index";
    indexLabel.textContent = "Comentário opcional";

    const label = document.createElement("label");
    label.htmlFor = "final-comment";
    label.textContent = set.finalPrompt;

    const input = document.createElement("textarea");
    input.id = "final-comment";
    input.className = "final-comment";
    input.maxLength = 1200;
    input.placeholder = "Se desejar, acrescente uma frase final.";
    input.value = state.finalComment;
    input.addEventListener("input", () => {
      state.finalComment = input.value;
      saveDraft();
    });

    wrap.append(indexLabel, label, input);
    elements.questionHost.appendChild(wrap);
    window.setTimeout(() => input.focus(), 80);
  }

  function validateCurrentStep() {
    state.participantCode = elements.participantCode.value.trim();
    state.participantRole = elements.participantRole.value;
    state.consent = elements.submissionConsent.checked;
    if (!state.participantCode) {
      showError("Informe um código do participante para permitir a comparação entre as etapas.");
      elements.participantCode.focus();
      return false;
    }
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(state.participantCode)) {
      showError("Use de 3 a 32 caracteres no código: letras sem acento, números, hífen ou sublinhado.");
      elements.participantCode.focus();
      return false;
    }
    if (!state.consent) {
      showError("Confirme o consentimento para participar da entrevista editorial.");
      elements.submissionConsent.focus();
      return false;
    }

    const set = sets[state.type];
    if (state.step >= set.questions.length) return true;
    const question = set.questions[state.step];
    const answer = state.answers[question.id];
    if (!answer) {
      showError("Escolha uma alternativa antes de continuar.");
      return false;
    }
    if (answer.choice === "E" && !answer.text.trim()) {
      showError("Digite sua resposta na opção “Outros”.");
      document.getElementById(`other-${question.id}`)?.focus();
      return false;
    }
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    const total = sets[state.type].questions.length;
    if (state.step < total) {
      state.step += 1;
      saveDraft();
      renderStep();
      elements.questionHost.querySelector("input, textarea")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    completeInterview();
  }

  function previousStep() {
    if (state.step === 0) return;
    state.step -= 1;
    saveDraft();
    renderStep();
    elements.questionHost.querySelector("input, textarea")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function makeSubmissionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `submission-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function completeInterview() {
    state.finalComment = document.getElementById("final-comment")?.value || state.finalComment;
    const completion = {
      schemaVersion: 1,
      questionnaireVersion: "1.0.0",
      submissionId: makeSubmissionId(),
      type: state.type,
      participantCode: state.participantCode,
      participantRole: state.participantRole,
      consent: true,
      startedAt: state.startedAt,
      completedAt: new Date().toISOString(),
      answers: state.answers,
      finalComment: state.finalComment.trim()
    };
    const completions = readStore(COMPLETION_KEY);
    completions[completionKey(completion.participantCode, completion.type)] = completion;
    writeStore(COMPLETION_KEY, completions);
    removeDraft(state.type);
    currentCompletion = completion;
    showResult(completion);
    submitCompletion(completion);
  }

  function showResult(completion) {
    const set = sets[completion.type];
    elements.resultTitle.textContent = `${set.title} concluída`;
    elements.resultLead.textContent = `Entrevista concluída para o código ${completion.participantCode}.`;
    renderPreview(completion);

    const pair = findPair(completion.participantCode);
    const hasPair = Boolean(pair.pre && pair.post);
    elements.comparisonCard.hidden = !hasPair;
    elements.downloadComparison.dataset.available = hasPair ? "true" : "false";
    showScreen("result");
  }

  function setDeliveryState(status, title, message) {
    elements.deliveryCard.dataset.status = status;
    elements.deliveryTitle.textContent = title;
    elements.deliveryMessage.textContent = message;
    elements.retrySubmission.hidden = status !== "error";
  }

  function submissionPayload(completion) {
    const set = sets[completion.type];
    return {
      schemaVersion: completion.schemaVersion,
      questionnaireVersion: completion.questionnaireVersion,
      submissionId: completion.submissionId,
      type: completion.type,
      participantCode: completion.participantCode,
      participantRole: completion.participantRole,
      consent: completion.consent,
      startedAt: completion.startedAt,
      completedAt: completion.completedAt,
      sourceUrl: window.location.href,
      website: "",
      answers: set.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        choice: completion.answers[question.id]?.choice || "",
        text: completion.answers[question.id]?.text || ""
      })),
      finalPrompt: set.finalPrompt,
      finalComment: completion.finalComment
    };
  }

  async function submitCompletion(completion) {
    const endpoint = String(window.INTERVIEW_API_URL || "").trim();
    if (!endpoint) {
      setDeliveryState("error", "Serviço indisponível", "Tente novamente mais tarde.");
      return;
    }

    setDeliveryState("sending", "Salvando resposta", "Aguarde a confirmação.");
    elements.retrySubmission.hidden = true;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionPayload(completion))
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw new Error(data.error || `HTTP ${response.status}`);
      setDeliveryState("success", data.duplicate ? "Resposta já recebida" : "Resposta recebida", "Confirmação concluída.");
    } catch (_error) {
      setDeliveryState("error", "Não foi possível confirmar", "Verifique sua conexão e tente novamente.");
    }
  }

  function renderPreview(completion) {
    elements.answerPreview.replaceChildren();
    const set = sets[completion.type];
    set.questions.forEach((question, index) => {
      const item = document.createElement("div");
      item.className = "answer-item";
      const prompt = document.createElement("strong");
      prompt.textContent = `${index + 1}. ${question.prompt}`;
      const answer = document.createElement("span");
      answer.textContent = formatAnswer(completion.answers[question.id]);
      item.append(prompt, answer);
      elements.answerPreview.appendChild(item);
    });
  }

  function formatAnswer(answer) {
    if (!answer) return "Sem resposta";
    return `${answer.choice}. ${answer.text}`;
  }

  function findPair(code) {
    const completions = readStore(COMPLETION_KEY);
    return {
      pre: completions[completionKey(code, "pre")] || null,
      post: completions[completionKey(code, "post")] || null
    };
  }

  function formatDate(iso) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  }

  function buildRecordText(completion) {
    const set = sets[completion.type];
    const lines = [
      "O CUSTO INVISÍVEL DO OLHO SECO",
      set.title,
      "",
      `Código: ${completion.participantCode}`,
      `Área: ${completion.participantRole || "não informada"}`,
      `Concluída em: ${formatDate(completion.completedAt)}`,
      ""
    ];
    set.questions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question.prompt}`);
      lines.push(`Resposta: ${formatAnswer(completion.answers[question.id])}`);
      lines.push("");
    });
    lines.push(set.finalPrompt);
    lines.push(completion.finalComment || "Sem comentário adicional.");
    lines.push("");
    lines.push("Nota: percepções de leitores não constituem evidência científica, endosso ou avaliação médica.");
    return lines.join("\n");
  }

  function buildComparisonText(pre, post) {
    const lines = [
      "O CUSTO INVISÍVEL DO OLHO SECO",
      "COMPARAÇÃO PRÉ × PÓS-LEITURA",
      "",
      `Código: ${pre.participantCode}`,
      `Área: ${post.participantRole || pre.participantRole || "não informada"}`,
      `Pré-leitura: ${formatDate(pre.completedAt)}`,
      `Pós-leitura: ${formatDate(post.completedAt)}`,
      ""
    ];
    sets.pre.questions.forEach((preQuestion, index) => {
      const postQuestion = sets.post.questions.find((question) => question.id === preQuestion.id);
      lines.push(`${index + 1}. DIMENSÃO: ${preQuestion.id.toLocaleUpperCase("pt-BR")}`);
      lines.push(`Antes — ${preQuestion.prompt}`);
      lines.push(`Resposta: ${formatAnswer(pre.answers[preQuestion.id])}`);
      lines.push(`Depois — ${postQuestion.prompt}`);
      lines.push(`Resposta: ${formatAnswer(post.answers[postQuestion.id])}`);
      lines.push("");
    });
    lines.push("Comentário pré-leitura:");
    lines.push(pre.finalComment || "Sem comentário adicional.");
    lines.push("");
    lines.push("Comentário pós-leitura:");
    lines.push(post.finalComment || "Sem comentário adicional.");
    lines.push("");
    lines.push("Interprete mudanças como percepção individual, não como evidência científica ou representação estatística.");
    return lines.join("\n");
  }

  function safeFilePart(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "participante";
  }

  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast("Respostas copiadas.");
  }

  function returnHome() {
    if (!elements.survey.hidden) saveDraft();
    showScreen("home");
  }

  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => startInterview(button.dataset.start));
  });

  elements.homeButton.addEventListener("click", returnHome);
  elements.backHome.addEventListener("click", returnHome);
  elements.finishHome.addEventListener("click", returnHome);
  elements.next.addEventListener("click", nextStep);
  elements.previous.addEventListener("click", previousStep);
  elements.form.addEventListener("submit", (event) => event.preventDefault());

  elements.participantCode.addEventListener("input", () => {
    state.participantCode = elements.participantCode.value;
    saveDraft();
    clearError();
  });

  elements.participantRole.addEventListener("change", () => {
    state.participantRole = elements.participantRole.value;
    saveDraft();
  });

  elements.submissionConsent.addEventListener("change", () => {
    state.consent = elements.submissionConsent.checked;
    saveDraft();
    clearError();
  });

  elements.retrySubmission.addEventListener("click", () => {
    if (currentCompletion) submitCompletion(currentCompletion);
  });

  elements.clearData.addEventListener("click", () => {
    const confirmed = window.confirm("Apagar todos os rascunhos e respostas salvos neste navegador?");
    if (!confirmed) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(COMPLETION_KEY);
    showToast("Dados locais apagados.");
  });

  elements.downloadText.addEventListener("click", () => {
    if (!currentCompletion) return;
    const suffix = currentCompletion.type === "pre" ? "pre-leitura" : "pos-leitura";
    download(
      buildRecordText(currentCompletion),
      `entrevista-${suffix}-${safeFilePart(currentCompletion.participantCode)}.txt`,
      "text/plain;charset=utf-8"
    );
  });

  elements.downloadJson.addEventListener("click", () => {
    if (!currentCompletion) return;
    const suffix = currentCompletion.type === "pre" ? "pre-leitura" : "pos-leitura";
    download(
      JSON.stringify(currentCompletion, null, 2),
      `entrevista-${suffix}-${safeFilePart(currentCompletion.participantCode)}.json`,
      "application/json;charset=utf-8"
    );
  });

  elements.copyResult.addEventListener("click", () => {
    if (currentCompletion) copyText(buildRecordText(currentCompletion));
  });

  elements.downloadComparison.addEventListener("click", () => {
    if (!currentCompletion) return;
    const pair = findPair(currentCompletion.participantCode);
    if (!pair.pre || !pair.post) return;
    download(
      buildComparisonText(pair.pre, pair.post),
      `comparacao-pre-pos-${safeFilePart(currentCompletion.participantCode)}.txt`,
      "text/plain;charset=utf-8"
    );
  });
})();
