/**
 * controllers/usuarios.controller.js
 * ----------------------------------------
 * Camada HTTP dos usuários (multi-tenant).
 * - Obtém tenant_id do cookie 'tenant_id', req.user.tenant_id ou header 'x-tenant-id'
 * - Encaminha tenant_id para o service em todas as operações
 *
 * Endpoints esperados:
 *  GET    /api/usuarios
 *  GET    /api/usuarios/designados
 *  POST   /api/usuarios
 *  PUT    /api/usuarios/:id
 *
 * Observações:
 * - A tabela utilizada é `usuarios` com UNIQUE(tenant_id, email).
 * - O service deve aplicar WHERE tenant_id = ? em todas as consultas.
 */

const service = require('../services/usuarios.service');
const asyncHandler = require('../utils/asyncHandler');

// Helper: resolve tenant_id (cookie -> req.user -> header)
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const t = Number(fromCookie ?? fromUser ?? fromHeader);
    return Number.isFinite(t) && t > 0 ? t : null;
}

exports.listar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const rows = await service.listar(tenantId);
    res.json(rows);
});

exports.listarDesignados = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const rows = await service.listarDesignados(tenantId);
    res.json(rows);
});

exports.criar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const r = await service.criar(tenantId, req.body);
    if (r.status) return res.status(r.status).json(r.body);
    res.json(r);
});

exports.atualizar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
    }

    const r = await service.atualizar(tenantId, id, req.body);
    if (r.status) return res.status(r.status).json(r.body);
    res.json({ sucesso: true, mensagem: 'Usuário atualizado com sucesso!' });
});
