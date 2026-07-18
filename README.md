# Site público — O Custo Invisível do Olho Seco

Landing page estática de pré-lançamento e entrevistas editoriais pré/pós-leitura. A interface é publicada no GitHub Pages; o envio das respostas passa por uma função serverless separada, que mantém o token do Notion fora do navegador.

## Arquitetura

- `/`: landing de pré-lançamento, sem venda ativa;
- `/entrevistas/`: duas entrevistas de oito perguntas, com rascunho e cópia local;
- `/api/responses.js`: função Vercel que valida, deduplica e grava no Notion;
- `scripts/build-pages.mjs`: gera `_site/` para o GitHub Pages;
- `.github/workflows/deploy-pages.yml`: publicação automática da branch `main`.

## Variáveis

Na Vercel:

- `NOTION_TOKEN` ou `NOTION_API_KEY` — segredo da integração interna do Notion;
- `NOTION_DATA_SOURCE_ID` — ID da fonte de dados de entrevistas;
- `ALLOWED_ORIGINS` — origens aceitas, separadas por vírgula.

No GitHub Actions, configure a variável de repositório `INTERVIEW_API_URL` com a URL HTTPS da função, terminando em `/api/responses`.

## Verificação local

```bash
python3 scripts/check-site.py
node --check entrevistas/app.js
node --check api/responses.js
node scripts/test-api.mjs
INTERVIEW_API_URL=http://127.0.0.1:3000/api/responses node scripts/build-pages.mjs
python3 scripts/test-e2e.py
```

O site permanece com `noindex,nofollow`, sem checkout e sem promoção pública enquanto o contrato comercial não mudar.
