/**
 * utils/asyncHandler.js
 * ----------------------------------------
 * Utilitário que encapsula funções async de controllers.
 * - Captura erros de Promises e envia para o middleware de erro
 * - Evita repetição de try/catch em cada controller
 * Uso: exports.fn = asyncHandler(async (req, res) => { ... })
 */

module.exports = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
