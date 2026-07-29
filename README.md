# Site público — O Custo Invisível do Olho Seco

Repositório próprio da landing de pré-lançamento do livro, atualmente alinhado
à edição v2.9.45. A interface é publicada no GitHub Pages; as entrevistas
editoriais permanecem integradas a uma função serverless separada.

## Rotas

- `/`: landing v2.9.45, sem venda, pré-venda ou checkout;
- `/referencias/`: referências completas da edição;
- `/kit/`: documentação do kit de execução;
- `/prontidao/`: avaliação local de prontidão;
- `/servicos/`: rota organizacional;
- `/entrevistas/`: entrevistas editoriais pré/pós-leitura;
- `/api/responses.js`: função Vercel, fora do artefato Pages.

## Estado comercial

`release.json` é o contrato estruturado. A página mostra preços observados nos
canais de referência, mas preserva:

- `sale_state=not_available`;
- `public_promotion=false`;
- `noindex,nofollow`;
- ausência de `Offer`, checkout, venda e pré-venda.

O valor do Amazon KDP está identificado como último valor confirmado no painel;
os valores do Clube dos Autores estão identificados como ofertas públicas
observadas.

## Build e deploy

O push na branch `main` aciona `.github/workflows/deploy-pages.yml`.
`scripts/build-pages.mjs` gera `_site/` e injeta a URL da API das entrevistas a
partir da variável de repositório `INTERVIEW_API_URL`.

```bash
npm run check
INTERVIEW_API_URL=http://127.0.0.1:3000/api/responses npm run build:pages
```

O gate valida versão, hashes, amostra de 30 páginas, imagem social 1200 × 630,
proporção responsiva das páginas, preços observados, ausência dos disclaimers
removidos, entrevistas 8+8 e ausência de segredo no cliente.

## Variáveis externas

Na Vercel:

- `NOTION_TOKEN` ou `NOTION_API_KEY`;
- `NOTION_DATA_SOURCE_ID`;
- `ALLOWED_ORIGINS`.

No GitHub Actions:

- `INTERVIEW_API_URL`: endpoint HTTPS terminado em `/api/responses`.

Nenhum segredo deve ser incluído no cliente ou no artefato do GitHub Pages.
