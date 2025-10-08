/**
 * src/controllers/acoes.controller.js
 * ----------------------------------------
 * Controller de Ações (somente S3/MinIO).
 * Estrutura de upload:
 *   <Empresa>/Processos/<Cliente - CPF_CNPJ>/<Título da Ação>/<arquivo>
 */

const path = require('path');
const service = require('../services/acoes.service');
const asyncHandler = require('../utils/asyncHandler');
const {
    uploadBufferProcesso,
    presignedGetUrl,
    deleteByKey,
} = require('../services/storage.service');

/* ------------------------- helpers ------------------------- */
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const raw = (fromCookie ?? fromUser ?? fromHeader ?? '').toString().trim();
    const t = Number(raw);
    return Number.isFinite(t) && t > 0 ? t : null;
}

// nome seguro de arquivo
function safeName(name, fallback = 'arquivo') {
    return (name || '')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w.\-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '') || fallback;
}

// envia um arquivo (buffer) para S3 usando metadados da ação/cliente
async function uploadToS3ProcessoMeta({ tenantId, clienteNome, cpfCnpj, titulo, file, prefixo }) {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    const base = safeName(path.basename(file.originalname || `arquivo-${Date.now()}`, ext));
    const pref = prefixo ? `${String(prefixo).toUpperCase()}_` : '';
    const fname = `${pref}${base}${ext}`;

    const { key } = await uploadBufferProcesso({
        tenantId,
        clienteNome,
        cpfCnpj,
        titulo,
        buffer: file.buffer,          // memória (multer memoryStorage)
        filename: fname,
        contentType: file.mimetype,
    });

    const url = await presignedGetUrl({ key, expiresIn: 3600 });
    return { key, filename: fname, url, bucket: process.env.S3_BUCKET, mimetype: file.mimetype, size: file.size };
}

/* ------------------------- criar ação + uploads iniciais ------------------------- */
// POST /api/acoes
exports.criar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const { cliente_id, designado_id, titulo } = req.body;
    const status = (req.body.status && String(req.body.status).trim()) || 'Não iniciado';
    const complexidade = (req.body.complexidade && String(req.body.complexidade));
    const criador_id = req.cookies?.usuario_id || req.user?.id || null;

    if (!cliente_id || !titulo || !complexidade) {
        return res.status(400).json({ sucesso: false, mensagem: 'cliente_id, titulo e complexidade são obrigatórios' });
    }

    // 1) cria ação (sem anexos)
    const created = await service.criar({
        tenant_id: tenantId,
        cliente_id,
        designado_id,
        titulo,
        status,
        criador_id,
        complexidade,
    });
    const acaoId = created.id;

    // 2) dados do cliente para montar a pasta
    const cli = await service.getClienteBasico(tenantId, cliente_id); // { nome, cpf_cnpj }

    // 3) envia anexos iniciais (se vierem)
    const map = {
        contratoArquivo: { prefix: 'CON', tipo: 'contrato' },
        procuracaoArquivo: { prefix: 'PRO', tipo: 'procuracao' },
        declaracaoArquivo: { prefix: 'DEC', tipo: 'declaracao' },
        fichaArquivo: { prefix: 'FIC', tipo: 'ficha' },
        documentacaoArquivo: { prefix: 'DOC', tipo: 'documentacao' },
        provasArquivo: { prefix: 'PROV', tipo: 'provas' },
    };

    const anexos = [];
    for (const field of Object.keys(map)) {
        const arr = req.files?.[field] || [];
        const { prefix, tipo } = map[field];
        for (const file of arr) {
            const out = await uploadToS3ProcessoMeta({
                tenantId,
                clienteNome: cli?.nome || 'Cliente',
                cpfCnpj: cli?.cpf_cnpj || '000',
                titulo,
                file,
                prefixo: prefix,
            });
            anexos.push({ tipo, ...out });
            // (opcional) persistir metadados em tabela própria:
            // await service.registrarAnexoS3(tenantId, acaoId, { tipo, ...out });
        }
    }

    return res.status(201).json({
        sucesso: true,
        mensagem: 'Ação criada com sucesso!',
        id: acaoId,
        anexos,
    });
});

/* ------------------------- upload adicional genérico ------------------------- */
// POST /api/acoes/:id/anexos  (campo de arquivo = "arquivo")
exports.uploadAnexoS3 = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const acaoId = String(req.params?.id || '').trim();
    if (!acaoId) return res.status(400).json({ sucesso: false, mensagem: 'ID da ação é obrigatório.' });
    if (!req.file) return res.status(400).json({ sucesso: false, mensagem: 'Arquivo não enviado.' });

    const meta = await service.getAcaoMeta(tenantId, acaoId); // { titulo, cliente_nome, cliente_cpf_cnpj }
    if (!meta) return res.status(404).json({ sucesso: false, mensagem: 'Ação não encontrada.' });

    const out = await uploadToS3ProcessoMeta({
        tenantId,
        clienteNome: meta.cliente_nome,
        cpfCnpj: meta.cliente_cpf_cnpj,
        titulo: meta.titulo,
        file: req.file,
        prefixo: '',
    });

    return res.status(201).json({
        sucesso: true,
        storage: 's3',
        nomeArquivo: out.filename,
        caminho: `s3://${out.bucket}/${out.key}`,
        bucket: out.bucket,
        key: out.key,
        url: out.url,
        mimetype: out.mimetype,
        size: out.size,
    });
});

/* ------------------------- rotas legadas (mesmo destino) ------------------------- */
async function uploadAntigo(req, res, prefixo) {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const { acao_id } = req.body;
    if (!acao_id || !req.file) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios não fornecidos' });
    }

    const meta = await service.getAcaoMeta(tenantId, acao_id);
    if (!meta) return res.status(404).json({ sucesso: false, mensagem: 'Ação não encontrada.' });

    const out = await uploadToS3ProcessoMeta({
        tenantId,
        clienteNome: meta.cliente_nome,
        cpfCnpj: meta.cliente_cpf_cnpj,
        titulo: meta.titulo,
        file: req.file,
        prefixo,
    });

    return res.status(201).json({
        sucesso: true,
        storage: 's3',
        bucket: out.bucket,
        key: out.key,
        url: out.url,
        nomeArquivo: out.filename,
    });
}

exports.uploadAcao = asyncHandler((req, res) => uploadAntigo(req, res, 'ACAO'));
exports.uploadContrato = asyncHandler((req, res) => uploadAntigo(req, res, 'CON'));
exports.uploadProcuracao = asyncHandler((req, res) => uploadAntigo(req, res, 'PRO'));
exports.uploadDeclaracao = asyncHandler((req, res) => uploadAntigo(req, res, 'DEC'));
exports.uploadFicha = asyncHandler((req, res) => uploadAntigo(req, res, 'FIC'));
exports.uploadDocumentacao = asyncHandler((req, res) => uploadAntigo(req, res, 'DOC'));
exports.uploadProvas = asyncHandler((req, res) => uploadAntigo(req, res, 'PROV'));

/* ------------------------- remover arquivo (S3) ------------------------- */
// POST /api/acoes/remover-arquivo  → { key }
exports.removerArquivo = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const { key } = req.body || {};
    if (!key) return res.status(400).json({ sucesso: false, mensagem: 'Envie a key do objeto a remover.' });

    await deleteByKey(key);
    res.json({ sucesso: true });
});

/* ------------------------- demais endpoints (inalterados) ------------------------- */
exports.listar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const itens = await service.listar(tenantId, req.query.status);
    const porDesignado = {};
    itens.forEach(acao => {
        const designado = acao.designado || 'Nenhum';
        if (!porDesignado[designado]) porDesignado[designado] = [];
        porDesignado[designado].push(acao);
    });
    res.json(porDesignado);
});

exports.aprovar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });
    await service.aprovar(tenantId, req.params.id);
    res.json({ sucesso: true });
});

exports.getStatus = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const dados = await service.getStatus(tenantId, req.params.id);
    if (!dados) return res.status(404).json({ erro: 'Ação não encontrada' });
    res.json(dados);
});

exports.updateStatus = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const { status, designado, complexidade } = req.body;
    await service.updateStatus(tenantId, req.params.id, { status, designado, complexidade });
    res.json({ sucesso: true });
});

exports.listarArquivos = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const data = await service.listarArquivos(tenantId, req.params.id);
    res.json(data);
});

exports.salvarComentario = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const { comentario } = req.body;
    if (!comentario) return res.status(400).json({ mensagem: 'Comentário inválido.' });
    await service.salvarComentario(tenantId, req.params.acaoId, comentario);
    res.json({ mensagem: 'Comentário salvo com sucesso!' });
});

exports.obterComentario = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const c = await service.obterComentario(tenantId, req.params.acaoId);
    res.json({ comentario: c });
});

exports.minhasAcoes = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const userId = req.user?.id || req.cookies?.usuario_id;
    if (!userId) return res.status(401).json({ sucesso: false, mensagem: 'Usuário não identificado' });

    const rows = await service.listarMinhas(tenantId, userId);
    res.json(rows);
});

exports.patchStatusMine = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });

    const acaoId = Number(req.params.id);
    const { status } = req.body;
    const userId = req.user?.id || req.cookies?.usuario_id;

    if (!acaoId || !status) return res.status(400).json({ error: 'ID e status são obrigatórios' });
    if (!userId) return res.status(401).json({ sucesso: false, mensagem: 'Usuário não identificado' });

    await service.atualizarStatusMine(tenantId, acaoId, userId, status);
    res.json({ ok: true });
});
