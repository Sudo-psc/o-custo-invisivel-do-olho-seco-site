import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { buildFlipbook } from "./build-flipbook.mjs";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "_site");
const apiUrl = String(process.env.INTERVIEW_API_URL || "").trim();

if (!apiUrl) throw new Error("INTERVIEW_API_URL é obrigatória para gerar o site público.");
const parsed = new URL(apiUrl);
if (parsed.protocol !== "https:" && !new Set(["127.0.0.1", "localhost"]).has(parsed.hostname)) {
  throw new Error("INTERVIEW_API_URL deve usar HTTPS fora do ambiente local.");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const name of ["index.html", "release.json", "robots.txt", ".nojekyll", "assets", "entrevistas", "kit", "livro", "privacidade", "prontidao", "referencias", "servicos"]) {
  await cp(resolve(root, name), resolve(output, name), { recursive: true });
}

// Destino da coleta analítica: sem as duas variáveis o arquivo continua nulo e
// a camada não carrega script nem faz requisição. O identificador do site no
// Umami é público; a chave de API do painel nunca entra no cliente.
const umamiUrl = String(process.env.UMAMI_URL || "").trim();
const umamiWebsiteId = String(process.env.UMAMI_WEBSITE_ID || "").trim();
let sink = null;
if (umamiUrl || umamiWebsiteId) {
  if (!umamiUrl || !umamiWebsiteId) {
    throw new Error("UMAMI_URL e UMAMI_WEBSITE_ID precisam ser definidas juntas.");
  }
  const parsedUmami = new URL(umamiUrl);
  if (parsedUmami.protocol !== "https:") {
    throw new Error("UMAMI_URL deve usar HTTPS.");
  }
  if (!/^[0-9a-f-]{16,64}$/i.test(umamiWebsiteId)) {
    throw new Error("UMAMI_WEBSITE_ID não parece um identificador do Umami.");
  }
  // barra final garantida: instância em subcaminho (https://host/umami) não
  // pode resolver o script para a raiz do domínio
  const base = parsedUmami.href.replace(/\/?$/, "/");
  sink = { provider: "umami", url: base, websiteId: umamiWebsiteId };
}
await writeFile(
  resolve(output, "assets", "analytics-config.js"),
  `window.ANALYTICS_SINK = ${JSON.stringify(sink)};\n`,
  "utf8"
);
console.log(
  sink
    ? `APROVA: coleta analítica apontada para ${new URL(sink.url).host} com auto-track desligado`
    : "APROVA: coleta analítica sem provedor; eventos permanecem no cliente"
);

// as páginas do flipbook são derivadas do PDF verificado, não versionadas:
// gerar direto no artefato mantém o repositório sem binários redundantes
const flipbook = await buildFlipbook({ outDir: resolve(output, "livro"), quiet: true });
console.log(`APROVA: flipbook com ${flipbook.page_count} páginas gerado a partir de ${flipbook.generated_from.path}`);

const configPath = resolve(output, "entrevistas", "config.js");
await readFile(configPath, "utf8");
await writeFile(configPath, `window.INTERVIEW_API_URL = ${JSON.stringify(apiUrl)};\n`, "utf8");

const interviewPath = resolve(output, "entrevistas");
const interviewIndexPath = resolve(interviewPath, "index.html");
let interviewIndex = await readFile(interviewIndexPath, "utf8");
for (const asset of ["styles.css", "data.js", "config.js", "app.js"]) {
  const content = await readFile(resolve(interviewPath, asset));
  const version = createHash("sha256").update(content).digest("hex").slice(0, 12);
  interviewIndex = interviewIndex.replace(`\"${asset}\"`, `\"${asset}?v=${version}\"`);
}
await writeFile(interviewIndexPath, interviewIndex, "utf8");
console.log(`APROVA: artefato Pages gerado em ${output}`);
