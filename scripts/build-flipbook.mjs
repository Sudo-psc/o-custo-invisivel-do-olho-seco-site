#!/usr/bin/env node
// Fluxo de geração do flipbook HTML5.
//
//   release.json (contrato: caminho + sha256 da amostra)
//        v
//   1. verifica a integridade do PDF                       (sha256)
//   2. lê a geometria e o número de páginas                (pdfinfo)
//   3. rasteriza páginas e miniaturas                      (pdftoppm)
//   4. extrai a camada de palavras com bounding boxes      (pdftotext -bbox-layout)
//        v
//   livro/paginas/*.jpg + livro/livro.json  ->  leitor em livro/index.html
//
// A camada de palavras é o que permite selecionar texto, marcar trechos e
// buscar dentro de uma página que, visualmente, é uma imagem.

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");

export const PAGE_DPI = 150;
export const THUMB_DPI = 24;
const PAGE_QUALITY = 82;
const THUMB_QUALITY = 70;

function log(message) {
  process.stdout.write(`[flipbook] ${message}\n`);
}

async function sha256(path) {
  const digest = createHash("sha256");
  digest.update(await readFile(path));
  return digest.digest("hex");
}

async function requireTool(name) {
  try {
    await run(name, ["-v"]);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `${name} não encontrado. Instale poppler-utils (Debian/Ubuntu: sudo apt-get install -y poppler-utils; macOS: brew install poppler).`
      );
    }
  }
}

// pdfinfo escreve a versão em stderr e sai com código != 0 em `-v`, por isso a
// checagem acima tolera falha e só trata ENOENT como ausência real do binário.
async function readPdfInfo(pdfPath) {
  const { stdout } = await run("pdfinfo", [pdfPath]);
  const pages = Number(stdout.match(/^Pages:\s+(\d+)$/m)?.[1]);
  const size = stdout.match(/^Page size:\s+([\d.]+) x ([\d.]+) pts/m);
  if (!Number.isInteger(pages) || pages < 1) throw new Error("pdfinfo não informou o número de páginas.");
  if (!size) throw new Error("pdfinfo não informou a geometria da página.");
  return {
    pages,
    title: stdout.match(/^Title:\s+(.+)$/m)?.[1]?.trim() || "",
    author: stdout.match(/^Author:\s+(.+)$/m)?.[1]?.trim() || "",
    widthPt: Number(size[1]),
    heightPt: Number(size[2]),
  };
}

// pdftoppm numera a saída com largura fixa e nome previsível; renomear no fim
// evita depender do padding escolhido pela versão instalada do poppler.
async function rasterize(pdfPath, outDir, { prefix, dpi, quality, pages }) {
  const digits = String(pages).length;
  await run("pdftoppm", [
    "-jpeg",
    "-jpegopt", `quality=${quality},progressive=y,optimize=y`,
    "-r", String(dpi),
    "-aa", "yes",
    "-aaVector", "yes",
    pdfPath,
    resolve(outDir, prefix),
  ]);
  const produced = (await readdir(outDir))
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".jpg"))
    .sort();
  if (produced.length !== pages) {
    throw new Error(`pdftoppm gerou ${produced.length} imagens para ${pages} páginas (prefixo ${prefix}).`);
  }
  const files = [];
  for (const [index, name] of produced.entries()) {
    const target = `${prefix}-${String(index + 1).padStart(digits, "0")}.jpg`;
    if (name !== target) {
      const { rename } = await import("node:fs/promises");
      await rename(resolve(outDir, name), resolve(outDir, target));
    }
    files.push(target);
  }
  return files;
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

// Converte o XHTML do `-bbox-layout` em, por página, uma lista de linhas e uma
// lista plana de palavras com caixas normalizadas (0..1). Normalizar aqui
// significa que o leitor não precisa saber nada sobre pontos, DPI ou zoom.
function parseWordLayer(xml, geometry) {
  const pages = [];
  const pageChunks = xml.split(/<page\b/).slice(1);
  for (const chunk of pageChunks) {
    const header = chunk.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
    const width = Number(header?.[1]) || geometry.widthPt;
    const height = Number(header?.[2]) || geometry.heightPt;
    const words = [];
    const lines = [];
    for (const lineChunk of chunk.split(/<line\b/).slice(1)) {
      const start = words.length;
      const wordPattern = /<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">([\s\S]*?)<\/word>/g;
      for (const match of lineChunk.matchAll(wordPattern)) {
        const text = decodeEntities(match[5]).trim();
        if (!text) continue;
        const xMin = Number(match[1]);
        const yMin = Number(match[2]);
        const xMax = Number(match[3]);
        const yMax = Number(match[4]);
        words.push({
          t: text,
          x: Number((xMin / width).toFixed(5)),
          y: Number((yMin / height).toFixed(5)),
          w: Number(((xMax - xMin) / width).toFixed(5)),
          h: Number(((yMax - yMin) / height).toFixed(5)),
        });
      }
      if (words.length > start) lines.push([start, words.length - 1]);
    }
    pages.push({ words, lines });
  }
  return pages;
}

function plainText(words) {
  return words.map((word) => word.t).join(" ");
}

// Heurística de sumário: a primeira linha curta da página, em caixa alta ou
// iniciando por numeração/rótulo de capítulo, vira o rótulo da página no índice.
function guessLabel(page, number) {
  const { words, lines } = page;
  for (const [start, end] of lines.slice(0, 4)) {
    const text = plainText(words.slice(start, end + 1)).trim();
    if (text.length < 4 || text.length > 72) continue;
    const isHeading =
      /^(cap[íi]tulo|parte|ap[êe]ndice|anexo|pref[áa]cio|introdu[çc][ãa]o|conclus[ãa]o|sum[áa]rio|refer[êe]ncias)\b/i.test(text) ||
      /^\d+(\.\d+)*\s+\S/.test(text) ||
      (text === text.toLocaleUpperCase("pt-BR") && /\p{L}/u.test(text));
    if (isHeading) return text;
  }
  const first = lines[0];
  if (first) {
    const text = plainText(words.slice(first[0], first[1] + 1)).trim();
    if (text.length >= 4 && text.length <= 72) return text;
  }
  return `Página ${number}`;
}

export async function buildFlipbook({ outDir, quiet = false } = {}) {
  const say = quiet ? () => {} : log;
  const release = JSON.parse(await readFile(resolve(root, "release.json"), "utf8"));
  const pdfPath = resolve(root, release.sample.path);

  for (const tool of ["pdfinfo", "pdftoppm", "pdftotext"]) await requireTool(tool);

  if (!(await stat(pdfPath).catch(() => null))) throw new Error(`amostra ausente: ${release.sample.path}`);
  const digest = await sha256(pdfPath);
  if (digest !== release.sample.sha256) {
    throw new Error(`sha256 da amostra diverge de release.json (${digest.slice(0, 12)}… != ${release.sample.sha256.slice(0, 12)}…).`);
  }
  say(`fonte verificada: ${basename(pdfPath)} sha256 ${digest.slice(0, 12)}…`);

  const info = await readPdfInfo(pdfPath);
  if (info.pages !== release.sample.pages) {
    throw new Error(`amostra tem ${info.pages} páginas e release.json declara ${release.sample.pages}.`);
  }

  const target = resolve(outDir ?? resolve(root, "livro"));
  const pagesDir = resolve(target, "paginas");
  await rm(pagesDir, { recursive: true, force: true });
  await mkdir(pagesDir, { recursive: true });

  say(`rasterizando ${info.pages} páginas a ${PAGE_DPI} dpi…`);
  const pageFiles = await rasterize(pdfPath, pagesDir, {
    prefix: "p", dpi: PAGE_DPI, quality: PAGE_QUALITY, pages: info.pages,
  });
  say(`rasterizando miniaturas a ${THUMB_DPI} dpi…`);
  const thumbFiles = await rasterize(pdfPath, pagesDir, {
    prefix: "m", dpi: THUMB_DPI, quality: THUMB_QUALITY, pages: info.pages,
  });

  say("extraindo camada de palavras…");
  const { stdout: bbox } = await run("pdftotext", ["-bbox-layout", "-enc", "UTF-8", pdfPath, "-"], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const layer = parseWordLayer(bbox, info);
  if (layer.length !== info.pages) {
    throw new Error(`camada de texto cobre ${layer.length} páginas e o PDF tem ${info.pages}.`);
  }

  // O manifesto é dividido em dois: `livro.json` carrega o índice, a busca e as
  // miniaturas na primeira pintura; `palavras.json` traz a camada de seleção e
  // é buscado em segundo plano, depois que a primeira página já está na tela.
  const scale = PAGE_DPI / 72;
  const pages = [];
  const wordLayer = [];
  let bytes = 0;
  for (let index = 0; index < info.pages; index += 1) {
    const number = index + 1;
    const { words, lines } = layer[index];
    bytes += (await stat(resolve(pagesDir, pageFiles[index]))).size;
    bytes += (await stat(resolve(pagesDir, thumbFiles[index]))).size;
    pages.push({
      n: number,
      src: `paginas/${pageFiles[index]}`,
      thumb: `paginas/${thumbFiles[index]}`,
      label: guessLabel(layer[index], number),
      text: plainText(words),
      count: words.length,
    });
    wordLayer.push({ n: number, words, lines });
  }

  const manifest = {
    schema: "flipbook-manifest/v1",
    generated_from: {
      path: release.sample.path,
      sha256: release.sample.sha256,
      book_version: release.book_version,
      source_commit: release.source_commit,
    },
    title: info.title || "O Custo Invisível do Olho Seco",
    author: info.author || "Dr. Philipe Saraiva Cruz",
    edition: `v${release.book_version}`,
    excerpt: true,
    page_count: info.pages,
    page: {
      width: Math.round(info.widthPt * scale),
      height: Math.round(info.heightPt * scale),
      aspect: Number((info.widthPt / info.heightPt).toFixed(5)),
      dpi: PAGE_DPI,
    },
    word_layer: "palavras.json",
    pages,
  };

  await writeFile(resolve(target, "livro.json"), `${JSON.stringify(manifest)}\n`, "utf8");
  await writeFile(
    resolve(target, "palavras.json"),
    `${JSON.stringify({ schema: "flipbook-words/v1", page_count: info.pages, pages: wordLayer })}\n`,
    "utf8"
  );
  const wordCount = pages.reduce((total, page) => total + page.count, 0);
  say(
    `APROVA: ${info.pages} páginas, ${wordCount} palavras indexadas, ` +
      `${(bytes / 1024 / 1024).toFixed(1)} MB de imagens em ${pagesDir.replace(`${root}/`, "")}`
  );
  return manifest;
}

// comparação por URL: resiste a symlink, separador do Windows e caminho
// relativo em process.argv[1], ao contrário de comparar strings de caminho
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = process.argv.indexOf("--out");
  await buildFlipbook({ outDir: flag > -1 ? process.argv[flag + 1] : undefined });
}
