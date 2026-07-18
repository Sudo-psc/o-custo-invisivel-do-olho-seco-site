"use strict";

const NOTION_VERSION = "2026-03-11";
const MAX_BODY_BYTES = 48_000;
const VALID_CODE = /^[A-Za-z0-9_-]{3,32}$/;
const VALID_CHOICES = new Set(["A", "B", "C", "D", "E"]);

function notionToken() {
  return process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || "";
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function allowedOrigins() {
  return new Set(
    String(process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function setCors(req, res) {
  const origin = String(req.headers.origin || "");
  if (allowedOrigins().has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    return true;
  }
  return false;
}

function asText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validIsoDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validatePayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Corpo inválido.";
  if (raw.website) return "Envio recusado.";
  if (raw.schemaVersion !== 1 || raw.questionnaireVersion !== "1.0.0") return "Versão do questionário inválida.";
  if (!asText(raw.submissionId, 80) || !/^[A-Za-z0-9-]{12,80}$/.test(raw.submissionId)) return "Identificador inválido.";
  if (!VALID_CODE.test(asText(raw.participantCode, 32))) return "Código inválido.";
  if (!new Set(["pre", "post"]).has(raw.type)) return "Momento inválido.";
  if (raw.consent !== true) return "Consentimento obrigatório.";
  if (!validIsoDate(raw.startedAt) || !validIsoDate(raw.completedAt)) return "Datas inválidas.";
  const elapsed = Date.parse(raw.completedAt) - Date.parse(raw.startedAt);
  if (elapsed < 2_000 || elapsed > 86_400_000) return "Duração de preenchimento inválida.";
  if (!Array.isArray(raw.answers) || raw.answers.length !== 8) return "São necessárias oito respostas.";
  const ids = new Set();
  for (const answer of raw.answers) {
    const id = asText(answer?.id, 48);
    const prompt = asText(answer?.prompt, 500);
    const choice = asText(answer?.choice, 1);
    const text = asText(answer?.text, 800);
    if (!id || ids.has(id) || prompt.length < 20 || !VALID_CHOICES.has(choice) || !text) return "Resposta inválida.";
    ids.add(id);
  }
  if (asText(raw.finalComment, 1200).length !== String(raw.finalComment || "").trim().length) return "Comentário final excede o limite.";
  try {
    const url = new URL(asText(raw.sourceUrl, 500));
    if (!new Set(["http:", "https:"]).has(url.protocol)) return "Origem inválida.";
  } catch (_error) {
    return "Origem inválida.";
  }
  return null;
}

async function notionRequest(path, options = {}) {
  let lastResponse;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    lastResponse = await fetch(`https://api.notion.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${notionToken()}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    if (lastResponse.ok || ![429, 500, 502, 503, 504].includes(lastResponse.status) || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return lastResponse;
}

function richText(content, annotations) {
  return { type: "text", text: { content: String(content).slice(0, 1900) }, ...(annotations ? { annotations } : {}) };
}

function pageBody(payload) {
  const moment = payload.type === "pre" ? "Pré-leitura" : "Pós-leitura";
  const sourceUrl = new URL(payload.sourceUrl);
  const properties = {
    "Registro": { title: [richText(`${moment} · ${payload.participantCode}`)] },
    "Submission ID": { rich_text: [richText(payload.submissionId)] },
    "Código": { rich_text: [richText(payload.participantCode)] },
    "Momento": { select: { name: moment } },
    "Área": { rich_text: payload.participantRole ? [richText(asText(payload.participantRole, 120))] : [] },
    "Concluída em": { date: { start: payload.completedAt } },
    "Origem": { url: `${sourceUrl.origin}${sourceUrl.pathname}`.slice(0, 500) },
    "Versão do questionário": { rich_text: [richText(payload.questionnaireVersion)] },
    "Consentimento": { checkbox: true }
  };

  const children = [
    { object: "block", type: "paragraph", paragraph: { rich_text: [richText("Uso editorial. Não interpretar como evidência científica, endosso ou avaliação médica.", { italic: true })] } },
    { object: "block", type: "heading_2", heading_2: { rich_text: [richText("Respostas")] } }
  ];
  payload.answers.forEach((answer, index) => {
    children.push({
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [
          richText(`${index + 1}. ${asText(answer.prompt, 500)}\n`, { bold: true }),
          richText(`${asText(answer.choice, 1)}. ${asText(answer.text, 800)}`)
        ]
      }
    });
  });
  children.push({ object: "block", type: "heading_3", heading_3: { rich_text: [richText(asText(payload.finalPrompt, 500) || "Comentário final")] } });
  children.push({ object: "block", type: "paragraph", paragraph: { rich_text: [richText(asText(payload.finalComment, 1200) || "Sem comentário adicional.")] } });
  return { parent: { type: "data_source_id", data_source_id: process.env.NOTION_DATA_SOURCE_ID }, properties, children };
}

async function alreadyExists(submissionId) {
  const response = await notionRequest(`/v1/data_sources/${process.env.NOTION_DATA_SOURCE_ID}/query`, {
    method: "POST",
    body: JSON.stringify({ page_size: 1, filter: { property: "Submission ID", rich_text: { equals: submissionId } } })
  });
  if (!response.ok) throw new Error(`Notion query failed: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.results) && data.results.length > 0;
}

async function handler(req, res) {
  const corsAllowed = setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = corsAllowed ? 204 : 403;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Método não permitido." });
  if (!corsAllowed) return json(res, 403, { ok: false, error: "Origem não autorizada." });
  if (!notionToken() || !process.env.NOTION_DATA_SOURCE_ID) return json(res, 503, { ok: false, error: "Integração indisponível." });
  if (Number(req.headers["content-length"] || 0) > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Conteúdo muito grande." });

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch (_error) { return json(res, 400, { ok: false, error: "JSON inválido." }); }
  }
  if (Buffer.byteLength(JSON.stringify(payload || {}), "utf8") > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Conteúdo muito grande." });
  const validationError = validatePayload(payload);
  if (validationError) return json(res, 400, { ok: false, error: validationError });

  try {
    if (await alreadyExists(payload.submissionId)) return json(res, 200, { ok: true, duplicate: true });
    const response = await notionRequest("/v1/pages", { method: "POST", body: JSON.stringify(pageBody(payload)) });
    if (!response.ok) throw new Error(`Notion create failed: ${response.status}`);
    const created = await response.json();
    return json(res, 201, { ok: true, duplicate: false, recordId: created.id });
  } catch (error) {
    console.error("Notion submission error", error instanceof Error ? error.message : "unknown");
    return json(res, 502, { ok: false, error: "Não foi possível confirmar o envio ao Notion." });
  }
}

module.exports = handler;
module.exports._test = { validatePayload, pageBody, setCors };
