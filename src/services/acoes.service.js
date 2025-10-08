/**
 * services/acoes.service.js
 * ----------------------------------------
 * Service de Ações — apenas DB + MinIO/S3 (sem filesystem local).
 *
 * - cria/atualiza/consulta ações no MySQL
 * - helpers para montar prefixos de S3 (cliente + título)
 * - listarArquivos: lê diretório da ação no S3 e devolve agrupado por tipo
 */

const { executeQuery } = require('../config/database');
const { listObjectsEmpresaCategoria, presignedGetUrl } = require('../services/storage.service');


/* ============================ Helpers gerais ============================ */

function assertTenant(tenant_id) {
    const t = Number(tenant_id);
    if (!Number.isFinite(t) || t <= 0) {
        const err = new Error('Tenant não identificado');
        err.status = 401;
        throw err;
    }
    return t;
}

// pasta/label segura (permite espaço e "-"; remove barras e símbolos perigosos)
function safeFolderLabel(str, fallback = 'NA') {
    const s = String(str || '')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\/\\]+/g, '-')             // evita quebrar prefixo no S3
        .replace(/[^\w\s.\-]+/g, '')          // mantém letras/números/espaço/._-
        .replace(/\s+/g, ' ')
        .trim();
    return s || fallback;
}

/* ============================ Queries auxiliares ============================ */

exports.getClienteBasico = async (tenantId, clienteId) => {
    const rows = await executeQuery(
        `SELECT id, nome, cpf_cnpj
       FROM clientes
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tenantId, clienteId]
    );
    return rows[0] || null;
};

exports.getAcaoMeta = async (tenantId, acaoId) => {
    const rows = await executeQuery(
        `SELECT a.id,
            a.titulo,
            a.designado_id,
            c.nome     AS cliente_nome,
            c.cpf_cnpj AS cliente_cpf_cnpj
       FROM acoes a
       JOIN clientes c ON c.id = a.cliente_id
      WHERE a.tenant_id = ? AND a.id = ?
      LIMIT 1`,
        [tenantId, acaoId]
    );
    return rows[0] || null;
};

async function getUsuarioById(tenantId, userId) {
    if (!userId) return null;
    const rows = await executeQuery(
        `SELECT id, nome, email
       FROM usuarios
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tenantId, userId]
    );
    return rows[0] || null;
}

async function getUsuarioIdByNome(tenantId, nome) {
    const rows = await executeQuery(
        `SELECT id
       FROM usuarios
      WHERE tenant_id = ? AND TRIM(LOWER(nome)) = TRIM(LOWER(?))
      LIMIT 1`,
        [tenantId, nome]
    );
    return rows[0]?.id || null;
}

/* ============================ Ações (DB) ============================ */

// Criar uma ação (sem mexer em arquivos — uploads vão pelo controller direto ao S3)
exports.criar = async ({
    tenant_id,
    cliente_id,
    designado_id,           // opcional
    titulo,
    status = 'Não iniciado',
    criador_id = null,
    complexidade,           // 'Baixa' | 'Média' | 'Alta'
}) => {
    const tId = assertTenant(tenant_id);
    if (!cliente_id) throw new Error('cliente_id é obrigatório');
    if (!titulo) throw new Error('titulo é obrigatório');
    if (!complexidade) throw new Error('complexidade é obrigatória');

    // valida cliente
    const cli = await exports.getClienteBasico(tId, cliente_id);
    if (!cli) throw new Error('Cliente não encontrado');

    // valida designado se veio
    let designadoIdFinal = null;
    if (designado_id && designado_id !== 'Nenhum') {
        const d = await getUsuarioById(tId, designado_id);
        if (d) designadoIdFinal = d.id;
    }

    // insere ação 
    const result = await executeQuery(
        `INSERT INTO acoes
       (tenant_id, cliente_id, titulo, complexidade, designado_id, criador_id, status, data_criacao)
     VALUES (?,         ?,          ?,      ?,            ?,            ?,         ?,        NOW())`,
        [tId, cli.id, titulo, complexidade, designadoIdFinal, (criador_id ?? null), status]
    );

    return { id: result.insertId };
};

/* ============================ Listagem / estado ============================ */

exports.listar = async (tenant_id, status) => {
    const tId = assertTenant(tenant_id);

    const params = [tId];
    let where = 'WHERE a.tenant_id = ?';
    if (status) {
        where += ' AND a.status = ?';
        params.push(status);
    }

    return executeQuery(
        `
    SELECT
      a.id,
      c.nome AS cliente,
      a.titulo,
      a.complexidade,
      COALESCE(uD.nome, 'Nenhum') AS designado,
      COALESCE(uC.nome, 'Sistema') AS criador,
      a.status,
      a.data_criacao,
      a.data_aprovado
    FROM acoes a
    LEFT JOIN clientes c ON c.id = a.cliente_id AND c.tenant_id = a.tenant_id
    LEFT JOIN usuarios uD ON uD.id = a.designado_id AND uD.tenant_id = a.tenant_id
    LEFT JOIN usuarios uC ON uC.id = a.criador_id   AND uC.tenant_id = a.tenant_id
    ${where}
    ORDER BY a.data_criacao DESC
    `,
        params
    );
};

exports.aprovar = (tenant_id, id) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `UPDATE acoes SET data_aprovado = NOW() WHERE tenant_id = ? AND id = ?`,
        [tId, id]
    );
};

exports.getStatus = async (tenant_id, id) => {
    const tId = assertTenant(tenant_id);
    const rows = await executeQuery(
        `
    SELECT a.status, a.complexidade, COALESCE(u.nome, 'Nenhum') AS designado
      FROM acoes a
      LEFT JOIN usuarios u ON u.id = a.designado_id AND u.tenant_id = a.tenant_id
     WHERE a.tenant_id = ? AND a.id = ?
     LIMIT 1
    `,
        [tId, id]
    );
    const r = rows[0];
    return r ? { status: r.status, complexidade: r.complexidade, designado: r.designado } : null;
};

exports.updateStatus = async (tenant_id, id, { status, designado, complexidade }) => {
    const tId = assertTenant(tenant_id);

    const sets = [];
    const params = [];

    if (status !== undefined) {
        sets.push('status = ?');
        params.push(status);
        const st = String(status || '').toLowerCase();
        if (['concluído', 'concluido', 'aprovado', 'protocolado'].includes(st)) {
            sets.push('data_concluido = IFNULL(data_concluido, NOW())');
        } else if (['em andamento', 'não iniciado', 'nao iniciado', 'devolvido'].includes(st)) {
            sets.push('data_concluido = NULL');
        }
    }

    if (designado !== undefined) {
        let desigId = null;
        if (designado === null || designado === '' || String(designado).toLowerCase() === 'nenhum') {
            desigId = null;
        } else if (/^\d+$/.test(String(designado))) {
            desigId = Number(designado);
            const u = await getUsuarioById(tId, desigId);
            if (!u) {
                const err = new Error('Designado não encontrado');
                err.status = 400;
                throw err;
            }
        } else {
            desigId = await getUsuarioIdByNome(tId, String(designado));
            if (!desigId) {
                const err = new Error('Designado não encontrado');
                err.status = 400;
                throw err;
            }
        }
        sets.push('designado_id = ?');
        params.push(desigId);
    }

    if (complexidade !== undefined && complexidade !== '') {
        sets.push('complexidade = ?');
        params.push(complexidade);
    }

    if (!sets.length) return;
    const sql = `UPDATE acoes SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`;
    params.push(tId, id);
    return executeQuery(sql, params);
};

/* ============================ Listagem de arquivos (S3) ============================ */

/**
 * Lê os anexos no S3 sob:
 *   <Empresa>/Processos/<Cliente - CPF>/<Título>/*
 * e agrupa por tipo com base no prefixo do nome do arquivo:
 *   CON_ | PRO_ | DEC_ | FIC_ | DOC_ | PROV_ | ACAO_
 * (também aceita versões antigas com "CON - ", etc.)
 */
exports.listarArquivos = async (tenant_id, acaoId) => {
    const tId = assertTenant(tenant_id);

    // pega metadados da ação/cliente
    const meta = await exports.getAcaoMeta(tId, acaoId); // { titulo, cliente_nome, cliente_cpf_cnpj, designado_id }
    if (!meta) {
        return {
            Contrato: [], Procuracao: [], Declaracao: [], Ficha: [],
            Documentacao: [], Provas: [], Acao: [], __designadoAtual: 'Nenhum',
        };
    }

    const clienteFolder = safeFolderLabel(`${meta.cliente_nome} - ${meta.cliente_cpf_cnpj}`);
    const tituloFolder = safeFolderLabel(meta.titulo, 'Sem Titulo');
    const subpath = `${clienteFolder}/${tituloFolder}`; // depois de <Empresa>/Processos/

    // lista objetos no S3 desse "diretório"
    const objetos = await listObjectsEmpresaCategoria({
        tenantId: tId,
        categoria: 'processos',
        subpath,
    }); // esperado: array de { Key, Size, LastModified }

    // helper p/ detectar tipo pelo nome do arquivo
    const tipoDe = (nome) => {
        const n = String(nome || '').toUpperCase();
        if (n.startsWith('CON_') || n.startsWith('CON - ')) return 'Contrato';
        if (n.startsWith('PRO_') || n.startsWith('PRO - ')) return 'Procuracao';
        if (n.startsWith('DEC_') || n.startsWith('DEC - ')) return 'Declaracao';
        if (n.startsWith('FIC_') || n.startsWith('FIC - ')) return 'Ficha';
        if (n.startsWith('DOC_') || n.startsWith('DOC - ')) return 'Documentacao';
        if (n.startsWith('PROV_') || n.startsWith('PROV - ')) return 'Provas';
        if (n.startsWith('ACAO_') || n.startsWith('ACAO - ')) return 'Acao';
        return 'Outros';
    };

    const grupos = {
        Contrato: [], Procuracao: [], Declaracao: [], Ficha: [],
        Documentacao: [], Provas: [], Acao: [], Outros: []
    };

    // monta resposta com URL assinada
    for (const obj of (objetos || [])) {
        const key = obj.Key || obj.key;
        if (!key) continue;
        const nome = key.split('/').pop();
        const grupo = tipoDe(nome);

        const url = await presignedGetUrl({ key, expiresIn: 3600 });
        const item = {
            nome,
            key,
            size: obj.Size || obj.size || null,
            lastModified: obj.LastModified || obj.lastModified || null,
            url,
        };
        if (!grupos[grupo]) grupos.Outros.push(item);
        else grupos[grupo].push(item);
    }

    // designado atual (nome)
    let designadoNome = 'Nenhum';
    if (meta.designado_id) {
        const u = await getUsuarioById(tId, meta.designado_id);
        if (u?.nome) designadoNome = u.nome;
    }

    return { ...grupos, __designadoAtual: designadoNome };
};

/* ============================ Comentários / visões ============================ */

exports.salvarComentario = (tenant_id, acaoId, comentario) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `UPDATE acoes SET comentario = ? WHERE tenant_id = ? AND id = ?`,
        [comentario, tId, acaoId]
    );
};

exports.obterComentario = async (tenant_id, acaoId) => {
    const tId = assertTenant(tenant_id);
    const rows = await executeQuery(
        `SELECT comentario FROM acoes WHERE tenant_id = ? AND id = ? LIMIT 1`,
        [tId, acaoId]
    );
    return rows[0]?.comentario || '';
};

exports.listarMinhas = (tenant_id, userId) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `
    SELECT
      a.id,
      a.protocolado,
      c.nome AS cliente,
      a.titulo,
      COALESCE(uD.nome, 'Nenhum') AS designado,
      COALESCE(uC.nome, 'Sistema') AS criador,
      a.status,
      a.data_concluido,
      a.data_aprovado,
      a.comentario,
      a.data_criacao
    FROM acoes a
    LEFT JOIN clientes c ON c.id = a.cliente_id AND c.tenant_id = a.tenant_id
    LEFT JOIN usuarios uD ON uD.id = a.designado_id AND uD.tenant_id = a.tenant_id
    LEFT JOIN usuarios uC ON uC.id = a.criador_id   AND uC.tenant_id = a.tenant_id
    WHERE a.tenant_id = ? AND a.designado_id = ?
    ORDER BY a.data_criacao DESC
    `,
        [tId, userId]
    );
};

exports.atualizarStatusMine = async (tenant_id, acaoId, userId, status) => {
    const tId = assertTenant(tenant_id);

    const check = await executeQuery(
        `SELECT id FROM acoes WHERE tenant_id = ? AND id = ? AND designado_id = ? LIMIT 1`,
        [tId, acaoId, userId]
    );
    if (!check.length) {
        const err = new Error('Ação não encontrada ou não pertence a você');
        err.status = 404;
        throw err;
    }
    await executeQuery(
        `UPDATE acoes SET status = ? WHERE tenant_id = ? AND id = ?`,
        [status, tId, acaoId]
    );
};
