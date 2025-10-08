/**
 * controllers/clientes.controller.js
 * ----------------------------------------
 * Camada HTTP dos clientes (multi-tenant).
 * - Obtém tenant_id do cookie 'tenant_id', req.user.tenant_id ou header 'x-tenant-id'
 * - Chama o service p/ listar/buscar, criar, obter, atualizar e excluir (sempre filtrando por tenant)
 *
 * Endpoints esperados:
 *  GET    /api/clientes?searchTerm=...
 *  GET    /api/clientes/busca-documento?q=...
 *  POST   /api/clientes
 *  GET    /api/clientes/:id
 *  PUT    /api/clientes/:id
 *  DELETE /api/clientes/:id
 *
 * Observações:
 * - A tabela utilizada no service deve ser `clientes` (plural).
 * - O service deve receber `tenantId` e aplicar WHERE tenant_id = ? em todas as consultas.
 */

const service = require('../services/clientes.service');
const asyncHandler = require('../utils/asyncHandler');

// Helper: resolve tenant_id (cookie -> req.user -> header)
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const t = Number(fromCookie ?? fromUser ?? fromHeader);
    return Number.isFinite(t) && t > 0 ? t : null;
}

// src/controllers/clientes.controller.js

exports.listar = asyncHandler(async (req, res) => {
    const tenantId = req.user?.tenant_id || req.query.tenant_id || req.headers['x-tenant-id'];
    if (!tenantId) return res.status(400).json({ error: 'tenant_id ausente' });

    const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '20', 10) || 20));
    const offset = (page - 1) * pageSize;
    const searchTerm = (req.query.searchTerm ?? '').trim();

    // ✅ Delega para o service:
    const data = await service.listar({ tenantId, limit: pageSize, offset, searchTerm });
    res.json(data);
});


exports.buscarParaDocumento = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const q = req.query.q ?? '';
    const data = await service.buscarParaDocumento(tenantId, q);
    res.json(data);
});

exports.criar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const result = await service.criar(tenantId, req.body);
    if (result?.status === 400) return res.status(400).json(result.body);
    res.json(result);
});

exports.obterPorId = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    const data = await service.obterPorId(tenantId, id);
    if (!data) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(data);
});

exports.atualizar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    const ok = await service.atualizar(tenantId, id, req.body);
    if (ok === 'NOT_FOUND') return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    if (ok === 'CPF_DUP') return res.status(400).json({ sucesso: false, mensagem: 'CPF/CNPJ já cadastrado para outro cliente' });
    res.json({ sucesso: true, mensagem: 'Cliente atualizado com sucesso!' });
});

exports.excluir = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    const ok = await service.excluir(tenantId, id);
    if (ok === 'NOT_FOUND') return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado' });
    res.json({ sucesso: true, mensagem: 'Cliente excluído com sucesso!' });
});
