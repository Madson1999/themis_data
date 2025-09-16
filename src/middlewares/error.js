/**
 * error.js
 * ----------------------------------------
 * Middlewares de tratamento de erro e 404.
 * - notFound → retorna 404 JSON para rotas inexistentes
 * - errorHandler → loga o erro e retorna status + mensagem padronizada
 * Garante respostas consistentes de erro na API.
 */

exports.notFound = (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
};

exports.errorHandler = (err, req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.code || err.message || 'Erro inesperado' });
};
