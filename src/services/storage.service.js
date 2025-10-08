// src/services/storage.service.js
'use strict';

const s3 = require('../config/s3');
const {
    PutObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { executeQuery } = require('../config/database');

const BUCKET = (process.env.S3_BUCKET || '').trim();
if (!BUCKET) {
    throw new Error('S3_BUCKET não definido no .env');
}

/* ============ helpers ============ */
function safeFolderLabel(str, fallback = 'NA') {
    const s = String(str || '')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\/\\]+/g, '-')        // evita quebrar prefix
        .replace(/[^\w\s.\-]+/g, '')     // mantém letras/números/espaço/._-
        .replace(/\s+/g, ' ')
        .trim();
    return s || fallback;
}

async function getEmpresaNome(tenantId) {
    const rows = await executeQuery(
        `SELECT nome_empresa FROM tenants WHERE id = ? LIMIT 1`,
        [tenantId]
    );
    return rows[0]?.nome_empresa || `Tenant_${tenantId}`;
}

function capitalize(s) {
    s = String(s || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Monta prefixo genérico por categoria:
 *   <Empresa>/<Categoria>/<subpath>/
 * Ex.: EmpresaX/Processos/Fulano - 123/<Título>/
 */
async function buildCategoriaPrefix({ tenantId, categoria, subpath }) {
    const empresa = safeFolderLabel(await getEmpresaNome(tenantId));
    const cat = safeFolderLabel(capitalize(categoria || 'Processos'));
    // normaliza subpath (remove barras nos extremos e espaços duplicados)
    const sp = String(subpath || '')
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .map(p => safeFolderLabel(p))
        .join('/');

    return `${empresa}/${cat}/${sp}/`;
}

// prefixo específico de processo: <Empresa>/Processos/<Cliente - CPF_CNPJ>/<Título>/
async function buildProcessoPrefix({ tenantId, clienteNome, cpfCnpj, titulo }) {
    const empresa = safeFolderLabel(await getEmpresaNome(tenantId));
    const clienteFolder = safeFolderLabel(`${clienteNome} - ${cpfCnpj}`);
    const tituloFolder = safeFolderLabel(titulo, 'Sem Titulo');
    return `${empresa}/Processos/${clienteFolder}/${tituloFolder}/`;
}

/* ============ operações “Processos” ============ */

// Upload de buffer para a pasta de um processo
async function uploadBufferProcesso({
    tenantId,
    clienteNome,
    cpfCnpj,
    titulo,
    buffer,
    filename,
    contentType,
}) {
    const prefix = await buildProcessoPrefix({ tenantId, clienteNome, cpfCnpj, titulo });
    const key = prefix + (filename || `arquivo-${Date.now()}`);

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
    }));

    return { bucket: BUCKET, key };
}

// Listar todos os objetos de um processo
async function listProcessoObjetos({ tenantId, clienteNome, cpfCnpj, titulo }) {
    const prefix = await buildProcessoPrefix({ tenantId, clienteNome, cpfCnpj, titulo });
    return listByPrefix(prefix);
}

/* ============ utilidades comuns S3 ============ */

// Lista genérica por prefixo (com paginação)
async function listByPrefix(prefix) {
    const out = [];
    let ContinuationToken;

    do {
        const resp = await s3.send(new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            ContinuationToken,
            MaxKeys: 1000,
        }));

        (resp.Contents || []).forEach(obj => {
            if (obj.Key && obj.Key !== prefix) {
                out.push({
                    Key: obj.Key,
                    Size: obj.Size ?? null,
                    LastModified: obj.LastModified ?? null,
                });
            }
        });

        ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (ContinuationToken);

    return out; // [{ Key, Size, LastModified }]
}

/**
 * Compatibilidade com acoes.service.js:
 * Lista objetos sob <Empresa>/<Categoria>/<subpath>/
 * args: { tenantId: number, categoria: string, subpath: string }
 * return: Promise<Array<{ Key, Size, LastModified }>>
 */
async function listObjectsEmpresaCategoria({ tenantId, categoria, subpath }) {
    const prefix = await buildCategoriaPrefix({ tenantId, categoria, subpath });
    return listByPrefix(prefix);
}

// URL assinada para download
async function presignedGetUrl({ key, expiresIn = 3600 }) {
    return getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn }
    );
}

// Remover objeto pela key completa
async function deleteByKey(key) {
    if (!key) return;
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

module.exports = {
    // Processos
    uploadBufferProcesso,
    listProcessoObjetos,

    // Categoria genérica (compatível com acoes.service.js)
    listObjectsEmpresaCategoria,

    // Comuns
    presignedGetUrl,
    deleteByKey,

    // Util (caso precise em outros pontos)
    listByPrefix,
};
