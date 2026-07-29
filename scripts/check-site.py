#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import struct
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    raise SystemExit(f"REPROVA: {message}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in {"a", "img", "link", "script", "source"}:
            return
        attr = "href" if tag in {"a", "link"} else "src"
        for key, value in attrs:
            if key == attr and value:
                self.links.append(value)


def validate_links(html_path: Path, text: str) -> None:
    parser = LinkCollector()
    parser.feed(text)
    for raw in parser.links:
        parsed = urlsplit(raw)
        if parsed.scheme in {"http", "https", "mailto", "tel", "data"} or raw.startswith("#"):
            continue
        target = (html_path.parent / unquote(parsed.path)).resolve()
        if target.is_dir():
            target = target / "index.html"
        if not target.exists() or ROOT.resolve() not in target.parents:
            fail(f"link local quebrado em {html_path.relative_to(ROOT)}: {raw}")


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) != 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        fail(f"PNG inválido: {path.relative_to(ROOT)}")
    return struct.unpack(">II", data[16:24])


release = json.loads((ROOT / "release.json").read_text(encoding="utf-8"))
version = release["book_version"]
if version != "2.9.45":
    fail(f"versão pública divergente: {version}")
if not re.fullmatch(r"[0-9a-f]{40}", release["source_commit"]):
    fail("commit-fonte inválido")
if release["sale_state"] != "not_available":
    fail("venda ativada sem gate externo")
if release["public_promotion"] is not False:
    fail("promoção pública ativada sem gate externo")
if release["formats"] != []:
    fail("formatos comerciais declarados sem listing")
for key in ("price", "channel", "checkout_url"):
    if release[key] is not None:
        fail(f"{key} declarado sem checkout verificável")
if release["kit"]["content_version"] != version or release["kit"]["compatible_with"] != version:
    fail("compatibilidade do kit divergente")

expected_prices = {
    "amazon_kdp_ebook": 39.90,
    "clube_autores_a5_color": 107.74,
    "clube_autores_a4_color": 148.02,
}
prices = release.get("observed_channel_prices_brl", {})
if {key: prices.get(key, {}).get("price") for key in expected_prices} != expected_prices:
    fail("preços observados divergem do registro aprovado")
if prices["amazon_kdp_ebook"].get("status") != "last_confirmed_in_kdp_dashboard":
    fail("KDP não está distinguido como último valor confirmado no painel")
for key in ("clube_autores_a5_color", "clube_autores_a4_color"):
    if prices[key].get("status") != "public_offer_observed":
        fail(f"{key} não está marcado como oferta pública observada")

for key in ("sample", "kit"):
    item = release[key]
    path = ROOT / item["path"]
    if not path.is_file():
        fail(f"artefato ausente: {path.relative_to(ROOT)}")
    if sha256(path) != item["sha256"]:
        fail(f"hash divergente: {path.relative_to(ROOT)}")

pages = subprocess.check_output(
    ["pdfinfo", str(ROOT / release["sample"]["path"])], text=True
)
if not re.search(r"^Pages:\s+30$", pages, re.M):
    fail("amostra não tem 30 páginas")

html_files = [path for path in ROOT.glob("**/*.html") if "_site" not in path.parts]
if not html_files:
    fail("HTML ausente")
for path in html_files:
    text = path.read_text(encoding="utf-8")
    if 'content="noindex,nofollow"' not in text:
        fail(f"noindex ausente: {path.relative_to(ROOT)}")
    validate_links(path, text)

active_version_files = (
    "index.html",
    "kit/index.html",
    "kit/COMPATIBILITY.md",
    "prontidao/index.html",
    "referencias/index.html",
    "servicos/index.html",
)
for relative in active_version_files:
    text = (ROOT / relative).read_text(encoding="utf-8")
    found = {match.removeprefix("v") for match in re.findall(r"v?2\.9\.\d+", text)}
    if found != {version}:
        fail(f"versão ativa divergente em {relative}: {sorted(found)}")

home = (ROOT / "index.html").read_text(encoding="utf-8")
for marker in (
    'meta name="book-version" content="2.9.45"',
    "Quatro Gates",
    "R$ 39,90",
    "R$ 107,74",
    "R$ 148,02",
    "Nenhuma venda ou pré-venda ocorre nesta página",
    "assets/og-image-v2945.png",
):
    if marker not in home:
        fail(f"marcador público ausente: {marker}")
for forbidden in (
    "Preços sugeridos para o lançamento no Brasil",
    "Sujeitos à validação do custo de impressão",
    "aprovação final em cada plataforma",
):
    if forbidden in home:
        fail(f"texto comercial removido reapareceu: {forbidden}")

css = (ROOT / "assets/experience.css").read_text(encoding="utf-8")
page_rule = re.search(r"\.page img\s*\{(?P<body>.*?)\}", css, re.S)
if not page_rule or "height: auto;" not in page_rule.group("body"):
    fail("imagens das páginas não preservam a proporção responsiva")

og_image = ROOT / "assets/og-image-v2945.png"
if png_size(og_image) != (1200, 630):
    fail("imagem Open Graph deve medir 1200 x 630")

legacy = [
    path
    for path in (ROOT / "assets").iterdir()
    if path.is_file() and re.search(r"v2\.9\.(?:26|27|28|29|31|44)", path.name)
]
if legacy:
    fail("downloads legados presentes: " + ", ".join(path.name for path in legacy))

data = (ROOT / "entrevistas/data.js").read_text(encoding="utf-8")
match = re.fullmatch(r"\s*window\.INTERVIEW_SETS\s*=\s*(\{.*\})\s*;\s*", data, re.S)
if not match:
    fail("data.js inválido")
sets = json.loads(match.group(1))
if set(sets) != {"pre", "post"}:
    fail("modalidades inválidas")
for kind, interview in sets.items():
    if len(interview["questions"]) != 8:
        fail(f"{kind}: número de perguntas inválido")
    for question in interview["questions"]:
        if len(question["options"]) != 4:
            fail(f"{kind}: alternativas inválidas")

app = (ROOT / "entrevistas/app.js").read_text(encoding="utf-8")
for needle in ("Outros: digite", "submitCompletion", "fetch(endpoint", "localStorage", "buildComparisonText"):
    if needle not in app:
        fail(f"app sem {needle}")
if "NOTION_TOKEN" in app or "NOTION_TOKEN" in (ROOT / "entrevistas/config.js").read_text():
    fail("segredo presente no cliente")
public_interview = app + (ROOT / "entrevistas/index.html").read_text(encoding="utf-8")
for forbidden in ("notion", "envio", "enviad"):
    if forbidden in public_interview.lower():
        fail(f"texto público proibido sobre transmissão: {forbidden}")

styles = (ROOT / "entrevistas/styles.css").read_text(encoding="utf-8")
for needle in (
    '.identity-card input:not([type="checkbox"])',
    '.participation-row input[type="checkbox"]',
    "min-width: 18px",
    ".participation-row span",
    "overflow-wrap: anywhere",
):
    if needle not in styles:
        fail(f"regressão no layout do consentimento: {needle}")

public_selectors = app + (ROOT / "entrevistas/index.html").read_text() + styles
for blocked_selector in ("consent-panel", "consent-row", "submission-consent"):
    if blocked_selector in public_selectors:
        fail(f"seletor vulnerável a extensão de privacidade: {blocked_selector}")

api = (ROOT / "api/responses.js").read_text(encoding="utf-8")
for needle in ("ALLOWED_ORIGINS", "NOTION_API_KEY", "NOTION_DATA_SOURCE_ID", "alreadyExists", "2026-03-11"):
    if needle not in api:
        fail(f"API sem {needle}")

print(
    f"APROVA: site v{version}, capa e páginas responsivas, preços observados, "
    "amostra 30 páginas, venda desativada, entrevistas 8+8 e API sem segredo no cliente"
)
