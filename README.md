# Site público — O Custo Invisível do Olho Seco

Repositório próprio da landing de pré-lançamento do livro, atualmente alinhado
à edição v2.9.45. A interface é publicada no GitHub Pages; as entrevistas
editoriais permanecem integradas a uma função serverless separada.

## Rotas

- `/`: landing v2.9.45, sem venda, pré-venda ou checkout;
- `/referencias/`: referências completas da edição;
- `/livro/`: leitura interativa da amostra em flipbook HTML5;
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

## Flipbook

`/livro/` é um leitor HTML5 da mesma amostra de 30 páginas: virada de página em
3D com som sintetizado, marcador de texto sobre a camada de palavras do PDF,
marcador de página, busca no texto, índice em miniaturas e retomada da leitura.
Não depende de biblioteca externa nem de rede além do próprio site; marcações e
posição ficam no `localStorage` do dispositivo e nada é transmitido.

O fluxo de geração parte do contrato, não do repositório:

```
release.json  ->  verifica sha256 da amostra
              ->  pdfinfo   páginas e geometria
              ->  pdftoppm  paginas/p-NN.jpg (150 dpi) e m-NN.jpg (24 dpi)
              ->  pdftotext -bbox-layout  camada de palavras
              ->  livro.json (índice e busca) + palavras.json (seleção)
```

```bash
npm run build:livro    # gera livro/paginas/, livro.json e palavras.json
```

O gerador falha se o sha256 ou a contagem de páginas divergirem de
`release.json`, então o flipbook nunca mostra uma edição diferente da declarada.
As imagens derivadas não são versionadas: `scripts/build-pages.mjs` roda o fluxo
ao montar `_site/`. Requer `poppler-utils` (o workflow já instala).

## Analytics

`ANALYTICS-CONTRACT.md` é executável: a tabela de eventos é a fonte da verdade
e `assets/events.js` a implementa em `SCHEMA`. Evento fora da tabela é
descartado, campo fora da linha do evento é removido, e valores só podem ser
número, booleano ou texto de até 64 caracteres — por isso o termo de busca e o
trecho marcado não atravessam a camada, entram como faixa e contagem.

Nada é transmitido: os eventos vão para `dataLayer`, para um `CustomEvent` por
nome e para um buffer de sessão em memória. `Do Not Track` e `Global Privacy
Control` desligam a coleta, e o leitor tem opt-out próprio em Marcações ›
Medição de leitura.

O gate reprova se a tabela e o `SCHEMA` divergirem, se algum `data-event` ou
`track()` ficar fora do contrato, ou se aparecer `fetch`, `sendBeacon`,
`XMLHttpRequest` ou URL na camada.

### Instância própria de Umami

O destino é uma instância própria, ligada por configuração — o endereço nunca
está no código. Sem as duas variáveis o site não carrega script de medição nem
faz requisição alguma.

```bash
UMAMI_URL=https://metricas.seu-dominio.com.br \
UMAMI_WEBSITE_ID=<uuid do site no painel> \
INTERVIEW_API_URL=<endpoint> npm run build:pages
```

No GitHub Actions, as mesmas duas como variáveis do repositório. O build
recusa endereço sem HTTPS, identificador malformado ou uma das duas sozinha.

Para subir a instância (Docker, com Postgres):

```bash
git clone https://github.com/umami-software/umami.git && cd umami
# defina DATABASE_URL e APP_SECRET no .env
docker compose up -d
```

Depois, no painel: crie o site, copie o *Website ID*, e ajuste a retenção para
os 12 meses declarados em `ANALYTICS-CONTRACT.md` e em `/privacidade/`.

O script sobe com `data-auto-track="false"`, então a instância recebe apenas os
eventos do contrato — nenhuma visita, clique ou rolagem é capturada por conta
própria. Com opt-out do leitor ou com `Do Not Track`/`Global Privacy Control`,
o script sequer é solicitado.

Declarar `analytics_provider` em `release.json` obriga, pelo gate, a publicar
`/privacidade/`, declarar retenção, manter `auto_track` e `cookies` em `false`
e nomear o provedor no contrato.

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
removidos, entrevistas 8+8, controles e camada de texto do flipbook e ausência
de segredo no cliente.

## Variáveis externas

Na Vercel:

- `NOTION_TOKEN` ou `NOTION_API_KEY`;
- `NOTION_DATA_SOURCE_ID`;
- `ALLOWED_ORIGINS`.

No GitHub Actions:

- `INTERVIEW_API_URL`: endpoint HTTPS terminado em `/api/responses`.

Nenhum segredo deve ser incluído no cliente ou no artefato do GitHub Pages.
