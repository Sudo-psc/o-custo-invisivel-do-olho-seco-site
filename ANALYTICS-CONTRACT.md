# Contrato mínimo de analytics

Estado: definido, implementado e com provedor escolhido — instância própria de
Umami, ligada por configuração de build. Sem `UMAMI_URL` e `UMAMI_WEBSITE_ID`
o site não carrega script de medição nem faz requisição alguma.

Este contrato é executável. A tabela abaixo é a fonte da verdade e
`assets/events.js` a implementa em `SCHEMA`; `scripts/check-site.py` reprova se
as duas divergirem. Um evento fora da tabela é descartado antes de sair da
camada de coleta, e um campo fora da linha do evento é removido do payload.

## Eventos permitidos

A coluna de campos lista as chaves exatas do payload, uma linha por evento, e é
comparada literalmente com o `SCHEMA` da camada. `—` significa que o evento não
carrega campo próprio.

| Evento | Finalidade | Campos próprios |
|---|---|---|
| `page_view` | visita à página | `referrer_host` |
| `sample_download` | interesse editorial | `href` |
| `kit_access` | acesso ao recurso | `href` |
| `kit_download` | download do recurso | `href` |
| `readiness_start` | início do scorecard | — |
| `readiness_complete` | conclusão do scorecard | `readiness_band`; nunca respostas individuais |
| `services_view` | interesse organizacional | `href` |
| `services_after_readiness` | interesse após o scorecard | `href` |
| `interviews_view` | interesse nas entrevistas | `href` |
| `fit_conversation_email` | intenção de contato | — ; conteúdo do e-mail não é analytics |
| `purchase_click` | saída para canal | `format`, `channel`, após definição humana |
| `flipbook_open` | abertura do leitor | `mode` |
| `flipbook_page_view` | profundidade de leitura | `page`, `mode` |
| `flipbook_turn` | forma de navegar | `direction`, `method` |
| `flipbook_bookmark` | uso do marcador de página | `page`, `action` |
| `flipbook_mark` | uso do marcador de texto | `page`, `color`, `action`; nunca o trecho marcado |
| `flipbook_search` | busca no texto | `hits`, `pages`, `term_band`; nunca o termo |
| `flipbook_marks_export` | exportação das marcações | `marks`, `bookmarks` |
| `flipbook_setting` | preferência de leitura | `setting`, `state` |
| `flipbook_reading_summary` | alcance da leitura | `pages_seen`, `deepest_page`, `duration_band`, `marks`, `bookmarks` |

Todo evento carrega `version` e `route`, preenchidos pela camada. Nenhum outro
campo é adicionado automaticamente.

## Dados proibidos

- sintomas, diagnósticos, escores individuais ou identificadores de participantes;
- nome, e-mail ou organização em eventos de navegação;
- conteúdo digitado em formulários, em e-mails ou no campo de busca do leitor;
- texto de trechos marcados pelo leitor;
- cruzamento com dados clínicos, trabalhistas ou de desempenho;
- fingerprinting ou perfil comportamental oculto.

## Como a proibição é aplicada

- só nomes de evento e campos da tabela passam; o resto é descartado na camada;
- valores só podem ser número, booleano ou texto de até 64 caracteres — um
  objeto com o trecho marcado ou com o termo buscado não atravessa;
- o termo de busca vira faixa (`short`, `medium`, `long`) e a duração vira
  faixa (`under_1min`, `1_5min`, `5_15min`, `over_15min`);
- do referrer entra apenas o host, nunca caminho ou query;
- não há identificador de sessão, de dispositivo ou de pessoa em nenhum evento.

## Controle de quem lê

- `Do Not Track` e `Global Privacy Control` desligam a coleta e não podem ser
  sobrepostos pelo controle da página;
- o leitor tem um botão de desligar em Marcações › Medição de leitura, com a
  escolha guardada em `book:analytics-optout` no próprio dispositivo;
- desligar apaga o buffer da sessão;
- `window.bookAnalytics.snapshot()` e `.events()` mostram exatamente o que foi
  coletado nesta sessão.

## Provedor

Instância própria de [Umami](https://umami.is), software livre, operada pelo
controlador. Não há Google Analytics, pixel de rede social nem provedor de
publicidade neste site.

| Item do gate | Definição |
|---|---|
| Responsável | Dr. Philipe Saraiva Cruz, CRM-MG 69.870, RQE 71.903 |
| Finalidade | medir alcance da amostra e uso da interface para decidir edição e produto |
| Base legal | legítimo interesse do controlador, art. 7º, IX, da LGPD |
| Retenção | 12 meses, aplicada na instância |
| Cookies | nenhum; sem identificador persistente de visitante |
| Consentimento | dispensado pela ausência de cookie e de identificação, com recusa disponível |
| Política de privacidade | `/privacidade/` |
| Acesso e exclusão | canal público do site, com resposta em até 15 dias |

O script sobe com `data-auto-track="false"`, então o provedor recebe apenas os
eventos desta tabela — nenhuma visita, clique ou rolagem é capturada por conta
própria. Com opt-out ou com sinal do navegador, o script sequer é solicitado.

O endereço da instância nunca aparece no código: vem de `UMAMI_URL` e
`UMAMI_WEBSITE_ID` no build, que geram `assets/analytics-config.js`. Não há
`fetch`, `sendBeacon`, `XMLHttpRequest` nem URL em `assets/events.js`, e o
validador reprova se aparecerem — trocar de destino é decisão de configuração,
registrada em `release.json`, nunca código escondido no cliente.

## Gate antes de trocar de provedor

Redefinir responsável, finalidade, base legal, retenção, cookies,
consentimento, política de privacidade, acesso e exclusão, e atualizar a tabela
acima, `/privacidade/` e `release.json` na mesma mudança. O validador reprova
se `analytics_provider` estiver declarado sem a página de privacidade
publicada, sem retenção declarada e sem o provedor nomeado neste documento.
