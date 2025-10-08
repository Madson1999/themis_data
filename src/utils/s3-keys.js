// src/utils/s3-keys.js
const path = require('path');
const { getSlugEmpresaByTenantId } = require('../services/tenants.service');

function safeName(name, fallback = 'arquivo') {
    return (name || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w.\-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '') || fallback;
}

const MAPA_CATEGORIA = {
    processos: 'Processos',
    usuarios: 'Usuarios',
    documentos: 'Documentos',
};

/**
 * Monta a Key no formato:
 *   <slug-empresa>/<Processos|Usuarios|Documentos>/<subpath?>/<filename>
 *
 * @param {number|string} tenantId
 * @param {'processos'|'usuarios'|'documentos'} categoria
 * @param {string} filename
 * @param {string} [subpath]       // ex: id do processo ou qualquer subpasta opcional
 */
async function buildEmpresaKey(tenantId, categoria, filename, subpath = '') {
    const slug = await getSlugEmpresaByTenantId(tenantId);
    const folder = MAPA_CATEGORIA[String(categoria || '').toLowerCase()];
    if (!folder) throw new Error('Categoria inválida. Use: processos, usuarios ou documentos.');

    const name = safeName(path.basename(filename || `file-${Date.now()}`));
    const sp = subpath ? `${String(subpath).replace(/^\/+|\/+$/g, '')}/` : '';
    return `${slug}/${folder}/${sp}${name}`;
}

module.exports = { buildEmpresaKey, safeName };
