/**
 * controllers/protocolacao.controller.js
 * ----------------------------------------
 * Camada HTTP de protocolação (multi-tenant).
 * - Lista aprovados do tenant
 * - Marca como protocolado (tenant-safe)
 * - Devolve ação (remove data_aprovado)
 * - Lista e baixa arquivos vinculados à ação (pasta por tenant)
 *
 * Regras SaaS:
 * - Obtém tenant_id do cookie 'tenant_id', req.user.tenant_id ou header 'x-tenant-id'
 * - Todos os métodos repassam tenant_id para o service
 */

const service = require('../services/protocolacao.service');
const asyncHandler = require('../utils/asyncHandler');

// Helper: resolve tenant_id (cookie -> req.user -> header)
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const t = Number(fromCookie ?? fromUser ?? fromHeader);
    return Number.isFinite(t) && t > 0 ? t : null;
}

exports.listarAprovados = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const rows = await service.listarAprovados(tenantId);
    res.json(rows);
});

exports.protocolar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
    }

    await service.protocolar(tenantId, id);
    res.json({ sucesso: true });
});

exports.devolver = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
    }

    await service.devolverAcao(tenantId, id);
    res.json({ sucesso: true, mensagem: 'Ação devolvida' });
});

exports.listarArquivos = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
    }

    const rows = await service.listarArquivos(tenantId, id);
    res.json(rows);
});

exports.downloadIndividual = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const id = Number(req.params.id);
    const nome = (req.query?.nome || '').trim();

    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID inválido' });
    }
    if (!nome) {
        return res.status(400).json({ sucesso: false, mensagem: 'Parâmetro "nome" é obrigatório' });
    }

    const out = await service.getArquivo(tenantId, id, nome);
    if (out.status) return res.status(out.status).send(out.body);
    res.download(out.abs, out.nome);
});
