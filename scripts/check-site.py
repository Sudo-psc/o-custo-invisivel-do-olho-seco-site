#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def fail(message: str) -> None:
    raise SystemExit(f"REPROVA: {message}")

release = json.loads((ROOT / "release.json").read_text())
version = release["book_version"]
if not re.fullmatch(r"\d+\.\d+\.\d+", version): fail("versão pública inválida")
if not re.fullmatch(r"[0-9a-f]{40}", release["source_commit"]): fail("commit-fonte inválido")
if release["sale_state"] != "not_available": fail("venda ativada sem gate externo")
if release["public_promotion"] is not False: fail("promoção pública ativada sem gate externo")
if release["formats"] != []: fail("formatos comerciais declarados sem listing")
for key in ("price", "channel", "checkout_url"):
    if release[key] is not None: fail(f"{key} declarado sem checkout verificável")
if release["kit"]["content_version"] != version or release["kit"]["compatible_with"] != version:
    fail("compatibilidade do kit divergente")
for key in ("sample", "kit"):
    item = release[key]
    path = ROOT / item["path"]
    if not path.is_file(): fail(f"artefato ausente: {path}")
    if hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]: fail(f"hash divergente: {path}")

pages = subprocess.check_output(["pdfinfo", str(ROOT / release["sample"]["path"])], text=True)
if not re.search(r"^Pages:\s+30$", pages, re.M): fail("amostra não tem 30 páginas")

html_files = list(ROOT.glob("**/*.html"))
if not html_files: fail("HTML ausente")
for path in html_files:
    if "_site" in path.parts: continue
    text = path.read_text()
    if 'content="noindex,nofollow"' not in text: fail(f"noindex ausente: {path.relative_to(ROOT)}")

active_version_files = (
    "index.html",
    "kit/index.html",
    "kit/COMPATIBILITY.md",
    "prontidao/index.html",
    "servicos/index.html",
    "assets/events.js",
)
for relative in active_version_files:
    text = (ROOT / relative).read_text()
    found = {match.removeprefix("v") for match in re.findall(r"v?2\.9\.\d+", text)}
    if found != {version}: fail(f"versão ativa divergente em {relative}: {sorted(found)}")

home = (ROOT / "index.html").read_text().lower()
for audience in ("saúde ocupacional", "rh", "ergonomia", "sesmt"):
    if audience not in home: fail(f"público primário ausente do hero: {audience}")

data = (ROOT / "entrevistas/data.js").read_text()
match = re.fullmatch(r"\s*window\.INTERVIEW_SETS\s*=\s*(\{.*\})\s*;\s*", data, re.S)
if not match: fail("data.js inválido")
sets = json.loads(match.group(1))
if set(sets) != {"pre", "post"}: fail("modalidades inválidas")
for kind, interview in sets.items():
    if len(interview["questions"]) != 8: fail(f"{kind}: número de perguntas inválido")
    for question in interview["questions"]:
        if len(question["options"]) != 4: fail(f"{kind}: alternativas inválidas")

app = (ROOT / "entrevistas/app.js").read_text()
for needle in ("Outros: digite", "submitCompletion", "fetch(endpoint", "localStorage", "buildComparisonText"):
    if needle not in app: fail(f"app sem {needle}")
if "NOTION_TOKEN" in app or "NOTION_TOKEN" in (ROOT / "entrevistas/config.js").read_text(): fail("segredo presente no cliente")
public_interview = app + (ROOT / "entrevistas/index.html").read_text()
for forbidden in ("notion", "envio", "enviad"):
    if forbidden in public_interview.lower(): fail(f"texto público proibido sobre transmissão: {forbidden}")

styles = (ROOT / "entrevistas/styles.css").read_text()
for needle in (
    '.identity-card input:not([type="checkbox"])',
    '.consent-row input[type="checkbox"]',
    "min-width: 18px",
    ".consent-row span",
    "overflow-wrap: anywhere",
):
    if needle not in styles: fail(f"regressão no layout do consentimento: {needle}")

api = (ROOT / "api/responses.js").read_text()
for needle in ("ALLOWED_ORIGINS", "NOTION_API_KEY", "NOTION_DATA_SOURCE_ID", "alreadyExists", "2026-03-11"):
    if needle not in api: fail(f"API sem {needle}")

print(f"APROVA: site v{version}, amostra 30 páginas, venda desativada, versões ativas conciliadas, entrevistas 8+8 e API Notion sem segredo no cliente")
