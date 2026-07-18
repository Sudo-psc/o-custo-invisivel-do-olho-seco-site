#!/usr/bin/env python3
from __future__ import annotations

import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
EVIDENCE = ROOT / "artifacts" / "evidence" / "initial-deploy"
BASE_URL = "http://127.0.0.1:4173/entrevistas/"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE, **kwargs)

    def log_message(self, _format, *_args):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:4173")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/responses":
            self.send_error(404)
            return
        size = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(size))
        assert payload["consent"] is True
        assert len(payload["answers"]) == 8
        body = json.dumps({"ok": True, "duplicate": False, "recordId": "e2e-record"}).encode()
        self.send_response(201)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def answer(page, kind: str, option_index: int) -> None:
    page.locator(f'[data-start="{kind}"]').click()
    assert page.locator("#setup-step").is_visible()
    assert page.locator("#question-host").is_hidden()
    assert page.locator("#progress-percent").inner_text() == "0%"
    page.locator("#participant-code").fill("QA-LEITOR-01")
    page.locator("#participant-role").select_option(label="CEO, direção ou conselho")
    page.locator("#submission-consent").check()
    page.locator("#next-question").click()
    assert page.locator("#setup-step").is_hidden()
    assert page.locator("#question-host").is_visible()
    assert page.locator("#progress-percent").inner_text() == "13%"
    for index in range(8):
        if kind == "pre" and index == 0:
            page.locator('.option-label input[value="E"]').check()
            page.locator(".other-input").fill("Uma pauta que precisa ser traduzida sem alarmismo.")
        else:
            page.locator(".option-label input[type='radio']").nth(option_index).check()
        page.locator("#next-question").click()
    page.locator("#final-comment").fill(f"Comentário do teste {kind}.")
    page.locator("#next-question").click()
    page.locator('#delivery-card[data-status="success"]').wait_for()


def assert_consent_layout(page) -> None:
    row = page.locator(".consent-row").bounding_box()
    checkbox = page.locator("#submission-consent").bounding_box()
    copy = page.locator(".consent-row span").bounding_box()
    assert row and checkbox and copy
    assert 16 <= checkbox["width"] <= 22, checkbox
    assert 16 <= checkbox["height"] <= 22, checkbox
    assert checkbox["x"] + checkbox["width"] <= row["x"] + row["width"] + 1
    assert copy["x"] >= checkbox["x"] + checkbox["width"] + 8
    assert copy["x"] + copy["width"] <= row["x"] + row["width"] + 1


def main() -> int:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 4173), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            )
            context = browser.new_context(viewport={"width": 1440, "height": 1000}, locale="pt-BR")
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto("http://127.0.0.1:4173/", wait_until="networkidle")
            assert page.locator('a[href="entrevistas/"]').count() >= 1
            page.screenshot(path=EVIDENCE / "landing-home.png", full_page=True)
            page.goto(BASE_URL, wait_until="networkidle")
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="networkidle")
            page.screenshot(path=EVIDENCE / "entrevistas-home.png", full_page=True)
            page.set_viewport_size({"width": 390, "height": 844})
            page.screenshot(path=EVIDENCE / "entrevistas-home-mobile.png", full_page=True)
            page.set_viewport_size({"width": 1440, "height": 1000})

            page.locator('[data-start="pre"]').click()
            assert page.locator("#setup-step").is_visible()
            assert_consent_layout(page)
            page.wait_for_timeout(300)
            page.screenshot(path=EVIDENCE / "entrevistas-consentimento-desktop.png", full_page=True)
            page.set_viewport_size({"width": 390, "height": 844})
            assert_consent_layout(page)
            assert page.locator("#setup-step").is_visible()
            assert page.locator("#question-host").is_hidden()
            assert page.evaluate("document.documentElement.scrollWidth === window.innerWidth")
            page.screenshot(path=EVIDENCE / "entrevistas-consentimento-mobile.png", full_page=True)
            page.locator("#participant-code").fill("QA-MOBILE-01")
            page.locator("#submission-consent").check()
            page.locator("#next-question").click()
            assert page.locator("#question-host").is_visible()
            assert page.locator("#progress-steps .is-current").inner_text() == "1"
            assert page.evaluate("document.documentElement.scrollWidth === window.innerWidth")
            for option in page.locator(".option-label").all():
                bounds = option.bounding_box()
                assert bounds and bounds["width"] >= 44 and bounds["height"] >= 44
            page.wait_for_timeout(300)
            page.evaluate("window.scrollTo(0, 0)")
            page.screenshot(path=EVIDENCE / "entrevistas-pergunta-mobile.png", full_page=True)
            page.locator("#previous-question").click()
            assert page.locator("#setup-step").is_visible()
            page.set_viewport_size({"width": 1440, "height": 1000})
            page.locator("#back-home").click()

            page.evaluate(
                """
                localStorage.setItem('ocioso-interview-drafts-v1', JSON.stringify({
                  pre: {
                    type: 'pre',
                    step: 0,
                    participantCode: 'RASCUNHO-ANTIGO',
                    participantRole: '',
                    consent: false,
                    answers: {association: {choice: 'A', text: 'Resposta anterior'}}
                  }
                }));
                """
            )
            page.set_viewport_size({"width": 390, "height": 844})
            page.locator('[data-start="pre"]').click()
            assert page.locator("#question-host").is_visible()
            page.locator("#next-question").click()
            assert page.locator("#setup-step").is_visible()
            assert page.locator(".consent-panel.has-error").is_visible()
            assert "Confirme o consentimento" in page.locator("#form-error").inner_text()
            page.wait_for_timeout(120)
            assert page.evaluate("document.activeElement.id") == "submission-consent"
            assert_consent_layout(page)
            page.evaluate("window.scrollTo(0, 0)")
            page.screenshot(path=EVIDENCE / "entrevistas-consentimento-validacao-mobile.png", full_page=True)
            page.locator("#back-home").click()
            page.evaluate("localStorage.clear()")
            page.set_viewport_size({"width": 1440, "height": 1000})

            answer(page, "pre", 0)
            assert page.locator("#delivery-title").inner_text() == "Resposta recebida"
            page.locator("#finish-home").click()
            answer(page, "post", 1)
            assert page.locator("#comparison-card").is_visible()
            assert page.locator("#answer-preview-content .answer-item").count() == 8
            page.wait_for_timeout(300)
            page.screenshot(path=EVIDENCE / "entrevistas-resultado.png", full_page=True)
            assert len(page.evaluate("JSON.parse(localStorage.getItem('ocioso-interview-completions-v1'))")) == 2
            assert not errors, errors
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    print("APROVA: E2E pré + pós, consentimento, envio API, cópia local e comparação")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
