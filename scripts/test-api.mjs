import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { _test } = require("../api/responses.js");

process.env.NOTION_DATA_SOURCE_ID = "1d07e18e-b473-4548-bff7-ec7897b63369";
const now = Date.now();
const payload = {
  schemaVersion: 1,
  questionnaireVersion: "1.0.0",
  submissionId: "123e4567-e89b-42d3-a456-426614174000",
  type: "pre",
  participantCode: "QA-001",
  participantRole: "CEO, direção ou conselho",
  consent: true,
  startedAt: new Date(now - 60_000).toISOString(),
  completedAt: new Date(now).toISOString(),
  sourceUrl: "https://sudo-psc.github.io/o-custo-invisivel-do-olho-seco-site/entrevistas/",
  website: "",
  answers: Array.from({ length: 8 }, (_, index) => ({ id: `q${index + 1}`, prompt: `Pergunta editorial suficientemente longa número ${index + 1}?`, choice: "A", text: "Resposta válida para o teste." })),
  finalPrompt: "Comentário final",
  finalComment: "Sem observações adicionais."
};

if (_test.validatePayload(payload) !== null) throw new Error("payload válido foi recusado");
if (!_test.validatePayload({ ...payload, consent: false })) throw new Error("consentimento ausente foi aceito");
if (!_test.validatePayload({ ...payload, answers: payload.answers.slice(0, 7) })) throw new Error("sete respostas foram aceitas");
const page = _test.pageBody(payload);
if (page.parent.data_source_id !== process.env.NOTION_DATA_SOURCE_ID) throw new Error("data source incorreta");
if (page.children.length !== 12) throw new Error(`blocos inesperados: ${page.children.length}`);
if (page.properties["Momento"].select.name !== "Pré-leitura") throw new Error("momento incorreto");
console.log("APROVA: validação, consentimento, payload Notion e deduplicação contratual");
