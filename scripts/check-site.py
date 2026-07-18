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
if release["book_version"] != "2.9.26": fail("versão pública divergente")
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

api = (ROOT / "api/responses.js").read_text()
for needle in ("ALLOWED_ORIGINS", "NOTION_TOKEN", "NOTION_DATA_SOURCE_ID", "alreadyExists", "2026-03-11"):
    if needle not in api: fail(f"API sem {needle}")

print("APROVA: site v2.9.26, amostra 30 páginas, entrevistas 8+8 e API Notion sem segredo no cliente")
