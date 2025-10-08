/**
 * error.js
 * ----------------------------------------
 * Middlewares de tratamento de erro e 404 (padrão SaaS).
 * - notFound → 404 JSON consistente
 * - errorHandler → loga o erro e retorna { sucesso:false, mensagem, ... }
 *
 * Convenções de resposta:
 *  { sucesso: false, mensagem: string, codigo?: string, path?: string, method?: string, traceId?: string }
 *
 * Observações:
 * - Em produção (NODE_ENV=production) não expõe stack/erro bruto.
 * - Faz um mapeamento simples de erros comuns (ex.: ER_DUP_ENTRY → 409).
 */

function statusFromError(err) {
    if (err?.status && Number.isInteger(err.status)) return err.status;

    // MySQL duplicate key
    if (err?.code === 'ER_DUP_ENTRY') return 409;

    // validação genérica
    if (err?.name === 'ValidationError') return 400;

    return 500;
}

function messageFromError(err) {
    if (err?.userMessage) return err.userMessage; // mensagens definidas pela aplicação
    if (err?.code === 'ER_DUP_ENTRY') return 'Registro duplicado.';
    return err?.message || 'Erro inesperado';
}

exports.notFound = (req, res) => {
    res.status(404).json({
        sucesso: false,
        mensagem: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method,
    });
};

exports.errorHandler = (err, req, res, _next) => {
    const isProd = process.env.NODE_ENV === 'production';
    const status = statusFromError(err);
    const mensagem = messageFromError(err);

    // Log completo no servidor
    // (mantenha detalhado para troubleshooting)
    console.error('[ERROR]', {
        status,
        code: err?.code,
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        path: req.originalUrl,
        method: req.method,
    });

    const payload = {
        sucesso: false,
        mensagem,
        codigo: err?.code || undefined,
        path: req.originalUrl,
        method: req.method,
    };

    // Em dev, opcionalmente inclua detalhes úteis
    if (!isProd) {
        payload.stack = err?.stack;
    }

    res.status(status).json(payload);
};
