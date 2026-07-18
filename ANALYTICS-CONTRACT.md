# Contrato mínimo de analytics

Estado: definido, ainda sem provedor conectado.

## Eventos permitidos

| Evento | Finalidade | Campos permitidos |
|---|---|---|
| `landing_view` | visita à página | versão, rota, referrer sem parâmetros sensíveis |
| `sample_download` | interesse editorial | versão, arquivo |
| `kit_access` / `kit_download` | ativação do recurso | versão, arquivo |
| `readiness_start` / `readiness_complete` | uso do scorecard | versão e faixa agregada; nunca respostas individuais |
| `services_view` | interesse organizacional | versão e origem da navegação |
| `fit_conversation_email` | intenção de contato | apenas clique; conteúdo do e-mail não é analytics |
| `purchase_click` | saída para canal | formato e canal, após definição humana |

## Dados proibidos

- sintomas, diagnósticos, escores individuais ou identificadores de participantes;
- nome, e-mail ou organização em eventos de navegação;
- conteúdo digitado em formulários ou e-mails;
- cruzamento com dados clínicos, trabalhistas ou de desempenho;
- fingerprinting ou perfil comportamental oculto.

## Gate antes de conectar um provedor

Definir responsável, finalidade, base legal quando aplicável, retenção, cookies, consentimento, política de privacidade, acesso e exclusão. Enquanto isso, os eventos permanecem apenas em `dataLayer` e `CustomEvent`, sem transmissão externa.
