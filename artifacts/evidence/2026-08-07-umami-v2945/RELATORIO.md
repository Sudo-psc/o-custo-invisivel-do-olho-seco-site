# Instância própria de Umami e aviso de privacidade v2.9.45

Data: 2026-08-07
Repositório:
`https://github.com/Sudo-psc/o-custo-invisivel-do-olho-seco-site`
Branch: `claude/openai-anthropic-blog-summary-w8tvud`
Estado inicial: `e6c8de0`

## Escopo autorizado

Escolha do provedor de analytics: instância própria de Umami, self-hosted. O
lote entrega o código, a configuração, o aviso de privacidade e o gate; a
instância em si é infraestrutura do controlador e ainda não existe.

## Como o provedor é ligado

O endereço nunca aparece no código. `UMAMI_URL` e `UMAMI_WEBSITE_ID` geram
`assets/analytics-config.js` no build, no mesmo padrão de `INTERVIEW_API_URL`
para as entrevistas. Sem as duas variáveis o arquivo fica nulo, e a camada não
carrega script nem faz requisição alguma — que é o estado publicado hoje.

O build recusa endereço sem HTTPS, identificador malformado e uma variável sem
a outra.

## Garantias do envio

- `data-auto-track="false"`: o Umami não captura visita, clique ou rolagem por
  conta própria; recebe exatamente os eventos do `SCHEMA`, e nenhum a mais;
- `data-do-not-track="true"`: redundância sobre a verificação da própria camada;
- com opt-out do leitor ou com `Do Not Track`/`Global Privacy Control`, o
  script **não é solicitado** — não há requisição a apagar depois;
- o que passou pela camada antes do script carregar é reenviado, sem perda;
- religar a medição depois de um opt-out carrega o script que não subiu.

## Mudanças

- `assets/analytics-config.js`: destino versionado como nulo, gerado no build;
- `assets/events.js`: conexão da instância, com fila até o script carregar,
  guarda contra conexão dupla e reconexão no opt-in;
- `scripts/build-pages.mjs`: injeção validada de `UMAMI_URL` e
  `UMAMI_WEBSITE_ID`, e `/privacidade/` no artefato;
- `privacidade/index.html`: aviso com controlador, finalidade, base legal
  (art. 7º, IX, LGPD), tabela do que é medido, lista do que nunca é medido,
  cookies, retenção de 12 meses, como recusar, direitos do titular e canal;
- `release.json`: `analytics_provider`, estado, fonte do endereço, retenção,
  base legal, controlador e caminho do aviso;
- `ANALYTICS-CONTRACT.md`: tabela dos itens do gate, fechada item a item;
- `scripts/check-site.py`: gate do vínculo entre provedor declarado, aviso
  publicado, retenção, ausência de cookie e auto-track, e link na home;
- `.github/workflows/deploy-pages.yml`, `README.md` com os passos de deploy;
- link para `/privacidade/` no rodapé da home e no painel do leitor.

## Verificação local

```text
npm run check
APROVA: … analytics com 20 eventos e campos conforme o contrato,
destino umami_self_hosted sem auto-track e com aviso publicado, …

npm run build:pages                       (sem variáveis)
APROVA: coleta analítica sem provedor; eventos permanecem no cliente
window.ANALYTICS_SINK = null;

UMAMI_URL=… UMAMI_WEBSITE_ID=… npm run build:pages
APROVA: coleta analítica apontada para metricas.exemplo.med.br
        com auto-track desligado
```

Validações do build, exercitadas:

| Entrada | Resultado |
|---|---|
| só `UMAMI_URL` | Error: precisam ser definidas juntas |
| `http://` | Error: deve usar HTTPS |
| identificador malformado | Error: não parece um identificador do Umami |

Gate do vínculo, exercitado contra desvio deliberado:

| Desvio introduzido | Resultado |
|---|---|
| `cookies: true` no release | REPROVA: provedor com auto-track ou cookie |
| retenção removida | REPROVA: provedor sem retenção definida |
| aviso de privacidade removido | REPROVA: link local quebrado em index.html |
| link do aviso removido da home | REPROVA: aviso não está linkado na página inicial |
| `autoTrack = "true"` na camada | REPROVA: script sem auto-track desligado |

Comportamento no artefato `_site`, com a instância interceptada no navegador:

- script solicitado exatamente uma vez, em
  `https://metricas.exemplo.med.br/script.js`, com `data-auto-track="false"`,
  `data-do-not-track="true"` e o identificador configurado;
- sessão de leitura com busca: 7 eventos entregues à instância, com as chaves
  `direction`, `hits`, `method`, `mode`, `page`, `pages`, `route`, `term_band`,
  `version` — nenhuma fora do contrato;
- busca por "lacrimal": o termo **não** aparece em nada do que foi enviado;
- opt-out no meio da sessão: zero envios a partir daí;
- recarga com opt-out ativo: **zero requisições** ao provedor e `window.umami`
  indefinido;
- religar: script solicitado e sink reconectado;
- `globalPrivacyControl`: zero requisições ao provedor;
- `/privacidade/` sem overflow horizontal em 390 px;
- zero erro de console em todas as rotas.

## Revisão do PR

Oito achados, todos procedentes. Três eram consequência de o lote ter
transformado um buffer local num destino remoto sem revisar as afirmações que
descreviam o estado anterior.

- **O painel do leitor afirmava "nada sai do dispositivo"** mesmo com a
  instância configurada e recebendo. Era falso justamente no controle que
  `/privacidade/` indica como forma de recusa. O texto passa a nomear o
  destino: "enviados para a instância própria em ⟨host⟩". Verificado.
- **Instância em subcaminho quebrava em silêncio.** `new URL("script.js", url)`
  descarta o prefixo quando a base não termina em barra, então uma instância
  publicada em `⟨host⟩/umami` buscava o script na raiz do domínio e recebia 404,
  sem erro visível. Barra final garantida no build e no cliente. Verificado:
  a URL solicitada preserva `/umami/script.js`.
- **A recusa só existia dentro do leitor**, mas todas as rotas medem. O aviso
  ganhou o mesmo controle, e ele vale para o site inteiro. Verificado: recusar
  em `/privacidade/` e ir para a landing deixa `isEnabled()` falso e
  `dataLayer` vazio.
- **Fila do provedor sem limite nem tratamento de erro.** Com o script
  bloqueado ou fora do ar, a fila crescia pela vida da página. Passou a ter
  teto de 100 e a desconectar o consumidor no `error`. Verificado com a
  requisição abortada: a página segue viva e o leitor funciona.
- **`BASE_FIELDS` era constante decorativa** — `track()` montava
  `version`/`route` na mão, então a asserção do validador sobre campos base não
  detectava desvio nenhum. Agora a lista governa o payload.
- **Vários resumos por sessão, com contadores cumulativos.** Cada página nova
  re-armava `reported`, então cada troca de aba emitia um resumo novo somando
  tudo de novo; agregá-los contaria a mesma leitura várias vezes. Passou a sair
  um único resumo, no `pagehide`. Verificado: três trocas de aba produzem zero
  resumos, e o `pagehide` produz exatamente um.
- **O gate era vendido como prova de não-transmissão.** Ele proíbe `fetch`,
  `sendBeacon`, `XHR` e URL na camada — o que garante ausência de endpoint fixo
  e de transporte improvisado, não ausência de tráfego, já que o envio real é o
  script do provedor. A mensagem e o comentário passam a dizer isso.
- **README se contradizia**: "Nada é transmitido" vinte linhas acima da seção
  do Umami. Ganhou a mesma qualificação que `/privacidade/` já trazia.

Nota: ao reescrever o comentário do primeiro achado, escrevi uma URL de exemplo
literal no código e o gate reprovou — a proibição de URL na camada funcionando
como projetada.

## Pendências do controlador

O código está pronto e inerte. Falta, e só o controlador pode fazer:

1. subir a instância de Umami e criar o site no painel;
2. definir `UMAMI_URL` e `UMAMI_WEBSITE_ID` como variáveis do repositório;
3. ajustar a retenção da instância para os 12 meses declarados;
4. confirmar controlador, canal de contato e retenção como publicados no aviso.

Até o passo 2, o site continua publicando sem medição externa.

Evidência visual:

- `visual/privacidade-topo.jpg`;
- `visual/privacidade-recusa.jpg`;
- `visual/privacidade-mobile.jpg`.
