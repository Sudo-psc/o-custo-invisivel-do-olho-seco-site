/* Destino da coleta analítica.
 *
 * Gerado pelo build a partir de UMAMI_URL e UMAMI_WEBSITE_ID, no mesmo padrão
 * de entrevistas/config.js. Fica nulo quando não há instância configurada, e
 * nesse caso a camada não carrega script nenhum nem faz requisição alguma.
 *
 * Não coloque segredo aqui: este arquivo é público. O identificador do site no
 * Umami é público por natureza; a chave de API do painel não entra no cliente.
 */
window.ANALYTICS_SINK = null;
