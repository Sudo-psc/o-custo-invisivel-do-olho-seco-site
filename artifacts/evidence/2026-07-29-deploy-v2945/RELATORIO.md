# Deploy da landing v2.9.45 no repositório próprio

Data: 2026-07-29
Repositório:
`https://github.com/Sudo-psc/o-custo-invisivel-do-olho-seco-site`
Branch: `main`
Estado inicial: `adfe08a` e worktree limpo

## Escopo autorizado

Atualizar e publicar a landing no repositório próprio já existente, preservando
as entrevistas e a função serverless. O lote não altera o manuscrito, os canais
de venda, o checkout ou os dados das entrevistas.

## Mudanças

- landing promovida de v2.9.31 para v2.9.45;
- amostra de 30 páginas e kit v2.9.45 instalados com hashes reconciliados;
- preços observados do Amazon KDP e Clube dos Autores promovidos sem ativar
  venda ou pré-venda;
- capa oficial, WebP responsivo e nova imagem social 1200 × 630;
- páginas internas corrigidas para proporção 2:3;
- gates móveis reposicionados e vitrine móvel compactada;
- aviso de pré-lançamento reorganizado;
- referências completas adicionadas ao artefato Pages;
- entrevistas, API e contrato de consentimento preservados;
- downloads v2.9.26–v2.9.31 e renders antigos removidos do pacote atual;
- subpáginas de kit, prontidão e serviços reconciliadas com v2.9.45;
- validador atualizado para preços observados, imagem social, links, versões,
  hashes, ausência dos disclaimers removidos e ausência de segredos no cliente.

## Verificação local

```text
npm run check
APROVA: site v2.9.45, capa e páginas responsivas, preços observados,
amostra 30 páginas, venda desativada, entrevistas 8+8 e API sem segredo
no cliente
APROVA: validação, consentimento, payload Notion e deduplicação contratual

INTERVIEW_API_URL=<variável do repositório> npm run build:pages
APROVA: artefato Pages gerado em _site
```

- desktop 1440 × 1000: sem overflow horizontal; páginas 416 × 624;
- mobile 390 × 844: sem overflow horizontal;
- quatro de quatro gates dentro da viewport;
- navegação nova: zero erros e zero avisos de console;
- imagem social: PNG 1200 × 630;
- amostra:
  `0589b6f2fa38e017f26217f424943af8837ef0bc4f062d0aafbd2e5be1f20cb2`;
- kit:
  `e6cb8c87cad1224b01dafa47b5a173dba9e04bcaa5f07c7bf5e267991da0011d`.

Evidência visual:

- `visual/local-hero-desktop.png`;
- `visual/local-book-desktop.png`;
- `visual/local-hero-mobile.png`;
- `visual/local-book-mobile.png`;
- `visual/local-gates-mobile.png`;
- `viewport-audit.json`.

## Limitação do ambiente

`scripts/test-e2e.py` não iniciou porque o módulo Python `playwright` não está
instalado no venv do livro. A landing foi inspecionada com o navegador
Playwright disponível no ambiente, e os arquivos das entrevistas não foram
alterados. O contrato de entrevistas e API passou no gate Node/Python do
repositório.

## Estado comercial

`sale_state=not_available`, `public_promotion=false`, `noindex,nofollow` e
ausência de checkout permanecem obrigatórios. Deploy da página não equivale a
publicação dos livros nos canais.
