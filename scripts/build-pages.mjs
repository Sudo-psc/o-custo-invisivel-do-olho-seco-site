import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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

for (const name of ["index.html", "release.json", ".nojekyll", "assets", "entrevistas", "kit", "prontidao", "servicos"]) {
  await cp(resolve(root, name), resolve(output, name), { recursive: true });
}

const configPath = resolve(output, "entrevistas", "config.js");
await readFile(configPath, "utf8");
await writeFile(configPath, `window.INTERVIEW_API_URL = ${JSON.stringify(apiUrl)};\n`, "utf8");
console.log(`APROVA: artefato Pages gerado em ${output}`);
