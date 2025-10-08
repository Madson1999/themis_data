/**
 * services/protocolacao.service.js
 * ----------------------------------------
 * Regras de protocolação pós-aprovação — Multi-tenant.
 * - Listar aprovados do tenant (com flag `protocolado`)
 * - Marcar “protocolado”
 * - Devolver ação (limpar `data_aprovado`)
 * - Listar arquivos da ação diretamente do bucket (S3/MinIO)
 *
 * Observações de schema:
 *  - acoes: possui tenant_id, cliente_id, designado_id, data_aprovado, protocolado
 *  - clientes/usuarios: também possuem tenant_id
 */

const { executeQuery } = require('../config/database');
const s3 = require('../config/s3');
const {
    ListObjectsV2Command,
    GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = (process.env.S3_BUCKET || '').trim();

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

/** Marca ação como protocolada */
exports.protocolar = (tenant_id, id) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `UPDATE acoes SET protocolado = 1 WHERE tenant_id = ? AND id = ?`,
        [tId, id]
    );
};

/** Devolve ação (remove data_aprovado) */
exports.devolverAcao = (tenant_id, id) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `UPDATE acoes SET data_aprovado = NULL WHERE tenant_id = ? AND id = ?`,
        [tId, id]
    );
};

/**
 * Lista arquivos existentes no bucket (MinIO/S3) da ação
 * O padrão de chave é algo como: `${tenant_id}/acoes/${acaoId}/`
 */
exports.listarArquivos = async (tenant_id, acaoId) => {
    const tId = assertTenant(tenant_id);
    const prefix = `${tId}/acoes/${acaoId}/`;

    const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
    });

    const result = await s3.send(command);
    const arquivos = [];

    if (result.Contents) {
        for (const obj of result.Contents) {
            const nome = obj.Key.replace(prefix, '');
            if (!nome) continue;

            const url = await getSignedUrl(
                s3,
                new GetObjectCommand({
                    Bucket: BUCKET,
                    Key: obj.Key,
                }),
                { expiresIn: 3600 } // 1 hora
            );

            arquivos.push({
                nome,
                tamanho: obj.Size,
                ultima_modificacao: obj.LastModified,
                url,
            });
        }
    }

    return arquivos;
};

/**
 * Gera link temporário para download de um arquivo específico
 */
exports.getArquivo = async (tenant_id, acaoId, nome) => {
    const tId = assertTenant(tenant_id);

    if (!nome) return { status: 400, body: 'Nome do arquivo é obrigatório' };
    if (nome.includes('..') || nome.includes('/') || nome.includes('\\')) {
        return { status: 400, body: 'Nome de arquivo inválido' };
    }

    const key = `${tId}/acoes/${acaoId}/${nome}`;

    try {
        const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        return { url, nome };
    } catch (err) {
        if (err.name === 'NoSuchKey') {
            return { status: 404, body: 'Arquivo não encontrado' };
        }
        console.error('Erro ao gerar URL de download:', err);
        return { status: 500, body: 'Erro interno ao gerar URL' };
    }
};
