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

## Camada de experiência (front-end imersivo)

A landing usa progressive enhancement: **primeiro o HTML semântico, acessível e
indexável; depois a camada visual**. Nada essencial vive dentro de `canvas`.

- `assets/experience.css`: CSS moderno — `@property`, *scroll-driven animations*
  (`animation-timeline: view()`/`scroll()`), *container queries*, `color-mix`,
  `light-dark`, `backdrop-filter`, bordas com `mask`. Tudo sob `@supports`, com
  degradação para navegadores sem suporte.
- `assets/tearfilm.js`: fundo decorativo do herói — simulação do **filme
  lacrimal** em WebGL2 (interferência de película fina; pontos secos que crescem
  com a rolagem e cicatrizam ao "piscar" com o ponteiro).
- `assets/experience.js`: brilho dos botões, cálculo da calculadora (via `submit`
  do formulário), painel de *scrollytelling* em canvas 2D e o **modo calmo**.

### Fallbacks e desempenho

O shader **não** roda — cai para um gradiente CSS estático (`html.no-tearfilm`) —
quando qualquer condição vale:

- ausência de WebGL2;
- `prefers-reduced-motion: reduce`;
- sinais de hardware/rede modestos: `navigator.connection.saveData`,
  `deviceMemory < 4` ou `hardwareConcurrency < 4`;
- **modo calmo** ligado pelo usuário (botão no cabeçalho, persistido em
  `localStorage.calmMode`).

Quando roda, o loop é pausado via `IntersectionObserver` (herói fora da tela) e
em `visibilitychange` (aba oculta); o `devicePixelRatio` é limitado a 2. O mesmo
vale para o canvas 2D do scrollytelling.

### Acessibilidade

`skip link`, landmarks (`header`/`nav`/`main`/`footer`), `section[aria-labelledby]`,
um único `h1`, foco visível (`:focus-visible`), navegação por teclado, `canvas`
decorativo com `aria-hidden` e canvas informativo com `role="img"`/`aria-label`.
`prefers-reduced-motion` e o modo calmo desligam animações e o shader.

### SEO técnico

`title`, meta description, `canonical`, Open Graph, Twitter Card e JSON-LD
(`Book` + autor, sem `Offer` nem avaliações, pois não há venda ativa) já estão
configurados. **A indexação permanece desligada** por decisão editorial/legal do
pré-lançamento: `robots.txt` bloqueia o rastreio e todo HTML mantém
`noindex,nofollow` (exigido por `scripts/check-site.py`).

Para abrir à indexação quando o contrato comercial mudar: remover o
`noindex,nofollow` do HTML, ajustar a asserção correspondente em
`scripts/check-site.py`, trocar o `robots.txt` por uma política aberta e publicar
um `sitemap.xml`.
