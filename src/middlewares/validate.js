/**
 * validate.js
 * ----------------------------------------
 * Middleware genérico para validação de requisições (padrão SaaS).
 * Compatível com Zod, Joi ou Yup.
 *
 * - Valida body, params e query de acordo com o schema fornecido
 * - Suporta versões síncronas e assíncronas (ex.: zod.safeParseAsync / yup.validate)
 * - Sanitiza/normaliza os dados se a lib suportar
 * - Retorna erro 422 com payload consistente:
 *     { sucesso: false, mensagem: 'Validação falhou', detalhes: [...] }
 *
 * Uso:
 *   router.post('/', validate(schema), controller.fn)
 *   // onde "schema" valida um objeto { body, params, query }
 */

// Torna o parser compatível com Zod, Joi e Yup (sync/async)
async function parseWithSchema(schema, payload) {
    if (!schema) return payload;

    // Zod (preferir async se existir)
    if (typeof schema.safeParseAsync === 'function') {
        const result = await schema.safeParseAsync(payload);
        if (!result.success) {
            const detalhes = result.error?.issues?.map(i => ({
                path: Array.isArray(i.path) ? i.path.join('.') : (i.path || ''),
                message: i.message,
            })) || [];
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes;
            throw err;
        }
        return result.data;
    }
    if (typeof schema.safeParse === 'function') {
        const result = schema.safeParse(payload);
        if (!result.success) {
            const detalhes = result.error?.issues?.map(i => ({
                path: Array.isArray(i.path) ? i.path.join('.') : (i.path || ''),
                message: i.message,
            })) || [];
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes;
            throw err;
        }
        return result.data;
    }

    // Joi
    if (typeof schema.validate === 'function') {
        // Joi v17+: validate pode ser sync; ainda assim tratamos como possivelmente async
        const maybePromise = schema.validate(payload, { abortEarly: false, stripUnknown: true });
        const { error, value } = await Promise.resolve(maybePromise);
        if (error) {
            const detalhes = (error.details || []).map(d => ({
                path: Array.isArray(d.path) ? d.path.join('.') : (d.path || ''),
                message: d.message,
            }));
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes;
            throw err;
        }
        return value;
    }

    // Yup (async)
    if (typeof schema.validate === 'function') {
        try {
            const value = await schema.validate(payload, { abortEarly: false, stripUnknown: true });
            return value;
        } catch (e) {
            const detalhes = (e.inner || []).map(d => ({
                path: (d.path || '').toString(),
                message: d.message,
            }));
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes.length ? detalhes : [{ message: e.message }];
            throw err;
        }
    }

    // Yup (sync) fallback
    if (typeof schema.validateSync === 'function') {
        try {
            return schema.validateSync(payload, { abortEarly: false, stripUnknown: true });
        } catch (e) {
            const detalhes = (e.inner || []).map(d => ({
                path: (d.path || '').toString(),
                message: d.message,
            }));
            const err = new Error('Validação falhou');
            err.status = 422;
            err.details = detalhes.length ? detalhes : [{ message: e.message }];
            throw err;
        }
    }

    // Schema desconhecido: retorna como veio
    return payload;
}

exports.validate = (schema) => async (req, res, next) => {
    try {
        // Validamos um objeto composto { body, params, query }
        const dados = { body: req.body, params: req.params, query: req.query };
        const parsed = await parseWithSchema(schema, dados);

        // Caso a lib retorne dados “sanitizados”, atualizamos req.*
        if (parsed && typeof parsed === 'object') {
            if (Object.prototype.hasOwnProperty.call(parsed, 'body')) req.body = parsed.body;
            if (Object.prototype.hasOwnProperty.call(parsed, 'params')) req.params = parsed.params;
            if (Object.prototype.hasOwnProperty.call(parsed, 'query')) req.query = parsed.query;
        }

        next();
    } catch (err) {
        const status = err.status || 422;
        return res.status(status).json({
            sucesso: false,
            mensagem: 'Validação falhou',
            detalhes: err.details || [{ message: err.message }],
        });
    }
};
