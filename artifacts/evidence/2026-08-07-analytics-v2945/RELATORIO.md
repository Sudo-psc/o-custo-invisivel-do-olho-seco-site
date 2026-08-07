# Eventos e coleta analítica v2.9.45

Data: 2026-08-07
Repositório:
`https://github.com/Sudo-psc/o-custo-invisivel-do-olho-seco-site`
Branch: `claude/openai-anthropic-blog-summary-w8tvud`
Estado inicial: `db6377e` e worktree limpo

## Escopo autorizado

Adicionar eventos e coleta de dados de analytics. O lote não conecta provedor
externo — isso continua atrás do gate humano descrito em
`ANALYTICS-CONTRACT.md` — e não altera manuscrito, versão pública, preços
observados, estado comercial nem entrevistas.

## Divergência encontrada no estado anterior

O contrato e o código já estavam fora de sincronia antes deste lote:

- `events.js` disparava `page_view`, mas a tabela declarava `landing_view`,
  que nunca era emitido;
- `interviews_view` e `services_after_readiness` eram disparados pelo HTML sem
  constar da tabela;
- o campo `href` acompanhava todo clique instrumentado sem estar declarado.

A reconciliação adotou o que o código realmente faz: `landing_view` saiu,
`page_view` entrou com `route` distinguindo a rota, e os dois eventos ausentes
foram declarados.

## Mudanças

- `assets/events.js` deixa de ser um repassador e passa a ser a camada de
  coleta: `SCHEMA` lista evento por evento os campos permitidos, evento fora da
  lista é descartado e campo fora da linha é removido antes de qualquer saída;
- valores restritos a número, booleano ou texto de até 64 caracteres — um
  objeto com o trecho marcado ou com o termo buscado não atravessa a camada;
- `Do Not Track` e `Global Privacy Control` desligam a coleta e não podem ser
  sobrepostos pelo controle da página;
- opt-out do leitor em Marcações › Medição de leitura, persistido em
  `book:analytics-optout`, que também apaga o buffer da sessão;
- `snapshot()` e `events()` expõem à própria pessoa o que foi coletado;
- `connect(fn)` é o ponto de conexão de um provedor, isolado e sem uso;
- 10 eventos novos do leitor: abertura, página vista, virada com método,
  marcador de página, marcador de texto, busca, exportação, preferências e
  resumo de leitura;
- `livro/flipbook.js` instrumentado; termo de busca vira faixa (`short`,
  `medium`, `long`) e duração vira faixa (`under_1min` a `over_15min`);
- `scripts/check-site.py` compara a tabela do contrato com o `SCHEMA`, verifica
  que nenhum `data-event` ou `track()` fica fora do contrato, e reprova se
  aparecer `fetch`, `sendBeacon`, `XMLHttpRequest` ou URL na camada;
- `livro/flipbook.css`: com o painel aberto o palco cede a faixa da direita —
  antes a gaveta cobria o livro e o botão de virar, e o controle de medição
  vive justamente nesse painel.

## Verificação local

```text
npm run check
APROVA: site v2.9.45, capa e páginas responsivas, preços observados,
amostra 30 páginas, flipbook com marcador de texto e de página,
analytics com 20 eventos conforme o contrato e sem transmissão,
venda desativada, entrevistas 8+8 e API sem segredo no cliente
APROVA: validação, consentimento, payload Notion e deduplicação contratual
```

O gate foi exercitado contra desvio deliberado, e reprovou nos cinco casos:

| Desvio introduzido | Resultado |
|---|---|
| evento no `SCHEMA` fora da tabela | REPROVA: contrato e camada divergem |
| `data-event` fora da tabela | REPROVA: evento disparado fora do contrato |
| `fetch()` na camada de coleta | REPROVA: transmissão externa |
| evento removido da tabela | REPROVA: contrato e camada divergem |
| termo de busca cru no lugar da faixa | REPROVA: leitor sem agregação em faixas |

Camada exercitada no artefato `_site` com Chromium:

- landing: `sample_download`, `kit_access`, `readiness_start`, `services_view`
  e `interviews_view` emitidos com `version` e `route`; `readiness_start` sai
  sem `href`, porque a linha dele não permite o campo;
- leitor: 15 eventos numa sessão de leitura, com `method` distinguindo botão,
  teclado, régua, arrasto, roda, miniatura, busca, marcador e painel;
- chaves presentes no `dataLayer` ao fim da sessão: `action`, `color`,
  `direction`, `event`, `hits`, `method`, `mode`, `page`, `pages`, `route`,
  `setting`, `state`, `term_band`, `version` — nenhuma fora do contrato;
- busca por "lacrimal" e trecho marcado de 20 palavras: o `dataLayer` não
  contém o termo nem o texto marcado;
- `track("evento_invalido", …)` descartado; campo `segredo` removido de um
  evento válido; texto de 200 caracteres truncado em 64;
- opt-out: zero eventos novos, buffer zerado, escolha preservada na recarga e
  reativação funcionando;
- `globalPrivacyControl`: zero eventos, botão oculto e aviso explicando;
- resumo de leitura emitido em `visibilitychange` com
  `pages_seen`, `deepest_page`, `duration_band` e contagens;
- painel aberto em 1440 × 900: livro reduz de 970 para 844 px e o botão de
  virar sai de baixo da gaveta; a virada funciona com o painel aberto;
- zero erro de console em todas as rotas.

## Ressalva registrada

A landing mantém 14 px de overflow horizontal em 390 × 844, originados de
`.grain` e `.orbit--a`. A condição é anterior a este lote e não foi tocada.

Evidência visual:

- `visual/medicao-ativa.jpg`;
- `visual/medicao-desativada.jpg`;
- `visual/medicao-sinal-do-navegador.jpg`.
