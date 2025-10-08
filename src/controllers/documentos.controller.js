/**
 * controllers/documentos.controller.js
 * ----------------------------------------
 * Geração de documentos (multi-tenant) – APENAS DOWNLOAD IMEDIATO.
 * - POST /api/documentos/gerar
 *   Body:
 *     { cliente_id, objeto_acao?, tipo_acao?, numero_documento?, requerido?, atendido_por?, data_atendimento?, indicador? }
 *     ou
 *     { cliente: {...}, objeto_acao?, tipo_acao?, numero_documento?, requerido?, atendido_por?, data_atendimento?, indicador? }
 *
 * Regras SaaS:
 * - O tenant_id é obtido do cookie 'tenant_id', req.user.tenant_id ou header 'x-tenant-id'
 * - Quando buscar por ID, lê o cliente na tabela `clientes` com filtro WHERE tenant_id = ?
 * - NÃO salva em S3 nem em pasta "gerados": apenas stream de download e limpeza do temp.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const asyncHandler = require('../utils/asyncHandler');
const { executeQuery } = require('../config/database');
const { gerarPacoteDocumentos } = require('../config/documentos');

// helper: tenant_id (cookie -> req.user -> header)
function getTenantId(req) {
    const fromCookie = req.cookies?.tenant_id;
    const fromUser = req.user?.tenant_id;
    const fromHeader = req.headers['x-tenant-id'];
    const raw = fromCookie ?? fromUser ?? fromHeader;
    const t = Number(String(raw).trim());
    return Number.isFinite(t) && t > 0 ? t : null;
}

// helper simples p/ data do input=date
function paraPtBr(iso) {
    if (!iso) return '';
    // evita timezone: concatena T00:00:00
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// normaliza array de docs retornados pelo gerador
// aceita string (caminho) ou objeto { path|caminho, filename|nome_arquivo|name, mimetype|contentType }
function normalizeDocs(docs) {
    const arr = Array.isArray(docs) ? docs : [];
    return arr.map((item) => {
        if (typeof item === 'string') {
            return {
                filePath: item,
                filename: path.basename(item),
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            };
        }
        const fp = item.path || item.caminho || item.filePath;
        const fn = item.filename || item.nome_arquivo || item.name || (fp ? path.basename(fp) : `doc-${Date.now()}.docx`);
        const ct =
            item.mimetype ||
            item.contentType ||
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        return { filePath: fp, filename: fn, contentType: ct };
    }).filter(d => !!d.filePath);
}

function safeFilename(name, fallback = 'documento') {
    return (name || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w.\-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '') || fallback;
}

exports.gerar = asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req);
    if (!tenantId) {
        return res.status(401).json({ sucesso: false, mensagem: 'Tenant não identificado' });
    }

    const {
        cliente_id,
        cliente: clienteBody,
        objeto_acao = '',
        tipo_acao = '',
        numero_documento,
        requerido = '',
        atendido_por = '',
        data_atendimento = '', // "yyyy-mm-dd"
        indicador = '',
    } = req.body || {};

    // 1) Carrega cliente (por id ou payload)
    let cliente = null;

    if (cliente_id) {
        const rows = await executeQuery(
            `
      SELECT
        id, nome, cpf_cnpj, rg,
        cidade, bairro, cep, uf, endereco,
        telefone1, email, profissao, nacionalidade, estado_civil
      FROM clientes
      WHERE tenant_id = ? AND id = ?
      LIMIT 1
      `,
            [tenantId, cliente_id]
        );

        if (!rows.length) {
            return res.status(400).json({ sucesso: false, mensagem: 'Cliente não encontrado para este tenant.' });
        }

        const r = rows[0];
        cliente = {
            id: r.id,
            nome: r.nome,
            cpf_cnpj: r.cpf_cnpj,
            rg: r.rg || '',
            nacionalidade: r.nacionalidade || '',
            estado_civil: r.estado_civil || '',
            profissao: r.profissao || '',
            cidade: r.cidade || '',
            uf: r.uf || '',
            endereco: r.endereco || '',
            bairro: r.bairro || '',
            cep: r.cep || '',
            telefone1: r.telefone1 || '',
            email: r.email || '',
        };
    } else if (clienteBody) {
        if (!clienteBody.nome || !clienteBody.cpf_cnpj) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe ao menos cliente.nome e cliente.cpf_cnpj.',
            });
        }
        cliente = clienteBody;
    } else {
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Envie cliente_id ou cliente (com nome e cpf_cnpj).',
        });
    }

    // 2) Normaliza data de atendimento (se veio do input=date)
    const dataAtendimentoBR = paraPtBr(data_atendimento);

    // 3) Gera o(s) documento(s) (em arquivos temporários)
    const resultado = await gerarPacoteDocumentos({
        tenant_id: tenantId,
        cliente,
        objeto_acao,
        tipo_acao,
        numero_documento,
        requerido,
        atendido_por,
        data_atendimento: dataAtendimentoBR,
        indicador,
    });

    const docs = normalizeDocs(resultado?.documentos);
    if (!docs.length) {
        return res.status(500).json({ sucesso: false, mensagem: 'Nenhum documento foi gerado.' });
    }

    // função para limpar temporários
    const cleanup = () => {
        for (const d of docs) {
            if (d.filePath) {
                fs.promises.unlink(d.filePath).catch(() => { });
            }
        }
    };

    // Se só um documento, baixa ele diretamente
    if (docs.length === 1) {
        const only = docs[0];
        const filename = safeFilename(only.filename || `documento-${Date.now()}.docx`, 'documento.docx');

        res.setHeader('Content-Type', only.contentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        const stream = fs.createReadStream(only.filePath);

        // Limpa arquivos temporários ao finalizar a resposta
        res.on('finish', cleanup);
        res.on('close', cleanup);

        stream.on('error', (err) => {
            cleanup();
            if (!res.headersSent) {
                res.status(500).json({ sucesso: false, mensagem: 'Falha ao ler o documento gerado.' });
            } else {
                res.destroy(err);
            }
        });

        stream.pipe(res);
        return; // importante: não enviar JSON
    }

    // Vários documentos → cria ZIP em streaming (sem salvar no disco)
    const zipNameBase =
        safeFilename(
            resultado?.numero_documento ||
            numero_documento ||
            `documentos-${Date.now()}`,
            'documentos'
        );
    const zipName = `${zipNameBase}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    // Limpeza ao final
    const finishCleanup = () => cleanup();
    res.on('finish', finishCleanup);
    res.on('close', finishCleanup);

    archive.on('error', (err) => {
        cleanup();
        if (!res.headersSent) {
            res.status(500).json({ sucesso: false, mensagem: 'Falha ao compactar os documentos.' });
        } else {
            res.destroy(err);
        }
    });

    archive.pipe(res);

    for (const d of docs) {
        const name = safeFilename(d.filename || path.basename(d.filePath));
        archive.file(d.filePath, { name });
    }

    await archive.finalize();
    // Não enviar JSON aqui; a resposta é o binário (ZIP)
});
