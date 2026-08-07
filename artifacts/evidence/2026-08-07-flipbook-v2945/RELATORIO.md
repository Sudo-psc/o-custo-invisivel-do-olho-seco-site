# Flipbook HTML5 da amostra v2.9.45

Data: 2026-08-07
Repositório:
`https://github.com/Sudo-psc/o-custo-invisivel-do-olho-seco-site`
Branch: `claude/openai-anthropic-blog-summary-w8tvud`
Estado inicial: `e851717` e worktree limpo

## Escopo autorizado

Criar um fluxo que gera uma versão HTML5 do livro em formato flipbook, com
efeito sonoro e visual de mudança de página, marcador de texto, marcador de
página e leitura interativa. O lote não altera o manuscrito, a versão pública,
os preços observados, o estado comercial nem as entrevistas.

## Fluxo de geração

```
release.json ──► sha256 e contagem de páginas da amostra conferidos
             ──► pdfinfo    30 páginas, 432 × 648 pt
             ──► pdftoppm   livro/paginas/p-NN.jpg 900 × 1350 (150 dpi)
                            livro/paginas/m-NN.jpg 144 × 216  (24 dpi)
             ──► pdftotext -bbox-layout   7 842 palavras com caixas
             ──► livro/livro.json   52 KB — índice, rótulos, texto, miniaturas
                 livro/palavras.json 482 KB — camada de seleção
```

O gerador aborta se o sha256 ou a contagem de páginas divergirem de
`release.json`, então o leitor não pode exibir uma edição diferente da
declarada. As imagens derivadas não são versionadas; `scripts/build-pages.mjs`
executa o fluxo ao montar `_site/`.

## Mudanças

- `scripts/build-flipbook.mjs`: fluxo de geração, exportando `buildFlipbook()`
  para o build do Pages e utilizável isolado via `npm run build:livro`;
- `livro/index.html`, `livro/flipbook.css`, `livro/flipbook.js`: leitor sem
  dependência externa, sem rede além do próprio site e sem transmissão de dados;
- virada de página em 3D com folhas de frente e verso girando na lombada,
  sombreamento derivado do ângulo, arrasto pelo canto e som sintetizado em
  WebAudio (ruído filtrado com varredura de banda, sem arquivo de áudio);
- marcador de texto em três cores sobre a camada de palavras, com fusão de
  trechos sobrepostos, cópia e remoção;
- marcador de página com fita na folha, marca na régua de progresso e lista
  navegável;
- leitura interativa: índice em miniaturas, busca no texto das 30 páginas com
  destaque temporário da ocorrência, régua de páginas, teclado, roda, toque,
  página única ou dupla, tela cheia, exportação das marcações em Markdown e
  retomada da posição;
- `index.html`: acesso ao flipbook no herói, na navegação e na seção do livro,
  sem novo evento de analytics — o contrato de eventos permanece inalterado;
- `scripts/check-site.py`: gate dos controles, da camada de texto, do respeito a
  movimento reduzido, da ausência de dependência externa no leitor e da
  presença do fluxo no artefato Pages;
- `scripts/build-pages.mjs`, `package.json`, `.gitignore`, `README.md`.

## Verificação local

```text
npm run check
APROVA: site v2.9.45, capa e páginas responsivas, preços observados,
amostra 30 páginas, flipbook com marcador de texto e de página,
venda desativada, entrevistas 8+8 e API sem segredo no cliente
APROVA: validação, consentimento, payload Notion e deduplicação contratual

INTERVIEW_API_URL=<variável do repositório> npm run build:pages
APROVA: flipbook com 30 páginas gerado a partir de assets/amostra-v2.9.45.pdf
APROVA: artefato Pages gerado em _site
```

Leitor exercitado no artefato `_site` com Chromium:

- dez viewports de 320 × 640 a 1920 × 1080: livro inteiro dentro da viewport,
  sem overflow horizontal do documento nem da barra de ferramentas;
- página dupla acima de 700 px de palco, página única abaixo, sem que a escolha
  salva prenda o livro num formato que não cabe;
- virada por botão, teclado, roda, arrasto do canto e régua: sem erro de
  console em nenhuma das rotas;
- camada de texto montada com 33 palavras na página 1 e 443 na página 13;
  seleção nativa preserva espaços e quebras de linha;
- marcador de texto desenhado em 8 retângulos sobre duas seleções de linhas
  múltiplas, persistido em `localStorage` e restaurado na recarga;
- marcador de página: fita na folha, marca na régua e entrada no painel;
- busca: 40 ocorrências de "olho seco" em 22 páginas e 14 de "filme lacrimal"
  em 10 páginas, com salto e destaque temporário da ocorrência;
- `prefers-reduced-motion: reduce`: virada instantânea, sem animação;
- manifesto ausente (404 simulado): estado explicativo com o comando de
  geração, sem erro de console;
- amostra:
  `0589b6f2fa38e017f26217f424943af8837ef0bc4f062d0aafbd2e5be1f20cb2`.

## Ressalva registrada

A landing mantém 14 px de overflow horizontal em 390 × 844, originados de
`.grain` e `.orbit--a`. A condição é anterior a este lote — medida idêntica em
`e851717` — e não foi tocada aqui.

Evidência visual:

- `visual/landing-acesso-flipbook.jpg`;
- `visual/flipbook-capa-desktop.jpg`;
- `visual/flipbook-virada-desktop.jpg`;
- `visual/flipbook-selecao-desktop.jpg`;
- `visual/flipbook-marcacoes-desktop.jpg`;
- `visual/flipbook-marcadores-desktop.jpg`;
- `visual/flipbook-busca-desktop.jpg`;
- `visual/flipbook-indice-desktop.jpg`;
- `visual/flipbook-mobile.jpg`.
