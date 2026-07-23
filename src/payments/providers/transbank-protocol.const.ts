/**
 * Nombres de campo del protocolo de retorno de Transbank (Webpay Plus y
 * Oneclick): no son elegibles por nosotros, los define el formulario que
 * genera el SDK; se centralizan aquí para no repetir el string crudo en
 * cada provider/controller que los lee.
 */
export const TransbankTokenField = {
  /** Campo del form de Webpay Plus con el token de la transacción exitosa. */
  TokenWs: 'token_ws',
  /** Campo presente cuando el usuario cancela o el formulario expira (Webpay y Oneclick). */
  TbkToken: 'TBK_TOKEN',
} as const;
