import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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

for (const name of ["index.html", "release.json", "robots.txt", ".nojekyll", "assets", "entrevistas", "kit", "prontidao", "servicos"]) {
  await cp(resolve(root, name), resolve(output, name), { recursive: true });
}

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
