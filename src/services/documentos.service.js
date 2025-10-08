/**
 * services/documentos.service.js
 * ----------------------------------------
 * Regras de documentos — Multi-tenant.
 * - Usa config/documentos (gerarPacoteDocumentos) para gerar os arquivos .docx
 * - Persiste metadados por documento em `documentos`:
 *      id, tenant_id, numero, cliente_id, tipo_documento, arquivo_path, data_criacao
 * - Consultas para listagem e recuperação de arquivo (sempre filtrando por tenant_id)
 *
 * Observações de schema:
 *  - Tabela de clientes: `clientes` (plural)
 *  - Tabela de documentos: `documentos` (com coluna tenant_id)
 *  - Útil ter índices: (tenant_id, cliente_id), (tenant_id, numero)
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../config/database');
const { gerarPacoteDocumentos } = require('../config/documentos');

/**
 * Gera um pacote de documentos e grava 1 linha por arquivo gerado em `documentos`.
 *
 * @param {number} tenant_id
 * @param {object} payload
 *    { cliente_id, objeto_acao?, tipo_acao?, numero_documento?,
 *      requerido?, atendido_por?, data_atendimento?, indicador? }
 * @returns {Promise<{sucesso: boolean, numero_documento: string, documentos: Array}>}
 */
exports.gerar = async (tenant_id, payload = {}) => {
    const tId = Number(tenant_id);
    if (!Number.isFinite(tId) || tId <= 0) {
        return { status: 401, body: { sucesso: false, mensagem: 'Tenant não identificado' } };
    }

    const cliente_id = Number(payload.cliente_id);
    if (!Number.isFinite(cliente_id) || cliente_id <= 0) {
        return { status: 400, body: { sucesso: false, mensagem: 'cliente_id é obrigatório' } };
    }

    // Confirma cliente do tenant
    const cRows = await executeQuery(
        `SELECT id, nome, cpf_cnpj
       FROM clientes
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tId, cliente_id]
    );
    if (!cRows.length) {
        return { status: 404, body: { sucesso: false, mensagem: 'Cliente não encontrado para este tenant' } };
    }
    const cliente = cRows[0];

    // Geração dos documentos (armazenamento já é segregado por tenant dentro de config/documentos)
    const resultado = await gerarPacoteDocumentos({
        tenant_id: tId,
        cliente,
        objeto_acao: payload.objeto_acao || '',
        tipo_acao: payload.tipo_acao || '',
        numero_documento: payload.numero_documento, // se vazio, o módulo cria um
        requerido: payload.requerido || '',
        atendido_por: payload.atendido_por || '',
        data_atendimento: payload.data_atendimento || '',
        indicador: payload.indicador || '',
    });

    // Persiste metadados: 1 linha por arquivo gerado
    // resultado.documentos → [{ tipo, sucesso, caminho, nomeArquivo, url }]
    const numeroDoc = resultado.numero_documento;
    for (const doc of resultado.documentos || []) {
        if (!doc.sucesso) continue;
        await executeQuery(
            `INSERT INTO documentos
        (tenant_id, numero, cliente_id, tipo_documento, arquivo_path, data_criacao)
       VALUES (?, ?, ?, ?, ?, NOW())`,
            [tId, numeroDoc, cliente.id, doc.tipo, doc.caminho]
        );
    }

    return {
        sucesso: true,
        numero_documento: numeroDoc,
        documentos: resultado.documentos,
    };
};

/**
 * Lista os últimos documentos do tenant (com nome do cliente).
 *
 * @param {number} tenant_id
 * @param {number} [limit=20]
 */
exports.listar = async (tenant_id, limit = 20) => {
    const tId = Number(tenant_id);
    if (!Number.isFinite(tId) || tId <= 0) return [];

    return executeQuery(
        `
    SELECT d.id,
           d.numero,
           d.tipo_documento,
           d.cliente_id,
           c.nome AS cliente_nome,
           d.arquivo_path,
           d.data_criacao
      FROM documentos d
      JOIN clientes c
        ON c.id = d.cliente_id
       AND c.tenant_id = d.tenant_id
     WHERE d.tenant_id = ?
     ORDER BY d.data_criacao DESC
     LIMIT ?
    `,
        [tId, Number(limit) || 20]
    );
};

/**
 * Recupera o caminho do arquivo para download (valida tenant).
 *
 * @param {number} tenant_id
 * @param {number} documentoId
 * @returns {Promise<{caminho:string, nome:string} | {status:number, body:any}>}
 */
exports.getArquivoPath = async (tenant_id, documentoId) => {
    const tId = Number(tenant_id);
    if (!Number.isFinite(tId) || tId <= 0) {
        return { status: 401, body: { sucesso: false, mensagem: 'Tenant não identificado' } };
    }
    const id = Number(documentoId);
    if (!Number.isFinite(id) || id <= 0) {
        return { status: 400, body: { sucesso: false, mensagem: 'documentoId inválido' } };
    }

    const dRows = await executeQuery(
        `SELECT arquivo_path
       FROM documentos
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tId, id]
    );
    if (!dRows.length) {
        return { status: 404, body: { sucesso: false, mensagem: 'Documento não encontrado' } };
    }

    const arquivoPath = dRows[0].arquivo_path;
    if (!(await fs.pathExists(arquivoPath))) {
        return { status: 404, body: { sucesso: false, mensagem: 'Arquivo do documento não encontrado' } };
    }

    return { caminho: arquivoPath, nome: path.basename(arquivoPath) };
};
