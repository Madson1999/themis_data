/**
 * validate.js
 * ----------------------------------------
 * Middleware genérico para validação de requisições.
 * Compatível com Zod, Joi ou Yup.
 * - Valida body, params e query de acordo com o schema fornecido
 * - Retorna erro 422 em caso de falha de validação
 * - Sanitiza/normaliza os dados se a lib suportar
 * Uso: router.post('/', validate(schema), controller.fn)
 */

function parseWithSchema(schema, payload) {
    // Zod
    if (schema && typeof schema.safeParse === 'function') {
        const result = schema.safeParse(payload);
        if (!result.success) {
            const detalhes = result.error?.issues?.map(i => ({
                path: i.path?.join('.') || '',
                message: i.message
            })) || [];
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes;
            throw err;
        }
        return result.data;
    }

    // Joi
    if (schema && typeof schema.validate === 'function') {
        const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
        if (error) {
            const detalhes = (error.details || []).map(d => ({
                path: d.path?.join('.') || '',
                message: d.message
            }));
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes;
            throw err;
        }
        return value;
    }

    // Yup (sincrono)
    if (schema && typeof schema.validateSync === 'function') {
        try {
            return schema.validateSync(payload, { abortEarly: false, stripUnknown: true });
        } catch (e) {
            const detalhes = (e.inner || []).map(d => ({
                path: (d.path || '').toString(),
                message: d.message
            }));
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes;
            throw err;
        }
    }

    // Sem schema: retorna como veio
    return payload;
}

exports.validate = (schema) => (req, res, next) => {
    try {
        // Padrão: validamos um objeto com body/params/query
        const dados = { body: req.body, params: req.params, query: req.query };
        const parsed = parseWithSchema(schema, dados);

        // Caso a lib retorne dados “sanitizados”, atualizamos req.*
        if (parsed?.body) req.body = parsed.body;
        if (parsed?.params) req.params = parsed.params;
        if (parsed?.query) req.query = parsed.query;

        next();
    } catch (err) {
        const status = err.status || 422;
        return res.status(status).json({
            error: 'Validação falhou',
            details: err.details || [{ message: err.message }]
        });
    }
};
