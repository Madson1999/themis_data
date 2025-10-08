/**
 * services/protocolacao.service.js
 * ----------------------------------------
 * Regras de protocolação pós-aprovação — Multi-tenant.
 * - Listar aprovados do tenant (com flag `protocolado`)
 * - Marcar “protocolado”
 * - Obter pasta da ação e ler/baixar arquivos
 * - Devolver ação (limpar `data_aprovado`)
 *
 * Observações de schema:
 *  - acoes: possui tenant_id, cliente_id, designado_id, arquivo_path, data_aprovado, protocolado
 *  - clientes/usuarios: também possuem tenant_id
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../config/database');

function assertTenant(tenant_id) {
    const t = Number(tenant_id);
    if (!Number.isFinite(t) || t <= 0) {
        const err = new Error('Tenant não identificado');
        err.status = 401;
        throw err;
    }
    return t;
}

/** Lista ações aprovadas (data_aprovado IS NOT NULL) com nomes resolvidos */
exports.listarAprovados = async (tenant_id) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `
    SELECT
      a.id,
      c.nome AS cliente,
      a.titulo,
      COALESCE(u.nome, 'Nenhum') AS designado,
      a.protocolado,
      a.data_aprovado
    FROM acoes a
    LEFT JOIN clientes c ON c.id = a.cliente_id AND c.tenant_id = a.tenant_id
    LEFT JOIN usuarios u ON u.id = a.designado_id AND u.tenant_id = a.tenant_id
    WHERE a.tenant_id = ? AND a.data_aprovado IS NOT NULL
    ORDER BY a.data_aprovado DESC
    `,
        [tId]
    );
};

exports.protocolar = (tenant_id, id) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `UPDATE acoes SET protocolado = 1 WHERE tenant_id = ? AND id = ?`,
        [tId, id]
    );
};

exports.devolverAcao = (tenant_id, id) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `UPDATE acoes SET data_aprovado = NULL WHERE tenant_id = ? AND id = ?`,
        [tId, id]
    );
};

/** Lista arquivos existentes na pasta da ação (se houver) */
exports.listarArquivos = async (tenant_id, id) => {
    const tId = assertTenant(tenant_id);

    const rows = await executeQuery(
        `SELECT arquivo_path FROM acoes WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tId, id]
    );
    if (!rows.length || !rows[0].arquivo_path) return [];

    const pasta = rows[0].arquivo_path;
    const existe = await fs.pathExists(pasta);
    if (!existe) return [];

    const nomes = await fs.readdir(pasta);
    const lista = [];
    for (const nome of nomes) {
        const abs = path.join(pasta, nome);
        const stat = await fs.stat(abs).catch(() => null);
        if (stat && stat.isFile()) {
            lista.push({
                nome,
                tamanho: stat.size,
                mtime: stat.mtime,
                url: `/api/protocolacao/${id}/arquivo?nome=${encodeURIComponent(nome)}`, // controller valida tenant
            });
        }
    }
    return lista;
};

/** Retorna caminho absoluto para download seguro do arquivo */
exports.getArquivo = async (tenant_id, id, nome) => {
    const tId = assertTenant(tenant_id);

    if (!nome) return { status: 400, body: 'Nome do arquivo é obrigatório' };
    if (nome.includes('..') || nome.includes('/') || nome.includes('\\')) {
        return { status: 400, body: 'Nome de arquivo inválido' };
    }

    const rows = await executeQuery(
        `SELECT arquivo_path FROM acoes WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tId, id]
    );
    if (!rows.length || !rows[0].arquivo_path) {
        return { status: 404, body: 'Ação ou pasta não encontrada' };
    }

    const pasta = rows[0].arquivo_path;
    const abs = path.join(pasta, nome);
    const existe = await fs.pathExists(abs);
    if (!existe) return { status: 404, body: 'Arquivo não encontrado' };

    return { abs, nome };
};
