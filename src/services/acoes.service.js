/**
 * acoes.service.js
 * ----------------------------------------
 * Service de Ações (processos) — Multi-tenant.
 *
 * Funcionalidades:
 * - Criar ação (monta pastas por tenant, move uploads iniciais e insere no banco)
 * - Upload adicional de arquivos (contrato, procuração, declaração, ficha, documentação, provas, ação)
 * - Remoção de arquivos associados a uma ação
 * - Listagem de ações (com filtro por status) — já retorna nomes (cliente, designado, criador)
 * - Aprovação de ação (define data_aprovado)
 * - Consulta/atualização de status e designado (aceita nome ou id)
 * - Listagem de arquivos por tipo
 * - Comentários (salvar/obter)
 * - “Minhas ações” (designadas ao usuário logado)
 *
 * Regras SaaS:
 * - TODAS as operações recebem e validam tenant_id.
 * - Tabela de clientes é `clientes` (plural).
 * - Tabela `acoes` contém chaves: (tenant_id, cliente_id, designado_id, criador_id, ...)
 * - Pastas de arquivos: public/uploads/PROCESSOS/<tenant_id>/<Inicial>/<Cliente>/ <Título>/
 */

const path = require('path');
const fs = require('fs-extra');
const { executeQuery } = require('../config/database');

/* ============================ Helpers ============================ */

const BASE_PROCESSOS = path.join(process.cwd(), 'public', 'uploads', 'PROCESSOS');

function assertTenant(tenant_id) {
    const t = Number(tenant_id);
    if (!Number.isFinite(t) || t <= 0) {
        const err = new Error('Tenant não identificado');
        err.status = 401;
        throw err;
    }
    return t;
}

async function ensureDir(p) {
    await fs.ensureDir(p);
    return p;
}

function safeFsName(s) {
    return String(s || '')
        .replace(/[\/\\?%*:|"<>]/g, '-') // caracteres proibidos
        .replace(/\s+/g, ' ')
        .trim();
}

async function gerarNomeUnico(dir, nomeDesejado) {
    let destino = path.join(dir, nomeDesejado);
    if (!(await fs.pathExists(destino))) return { nome: nomeDesejado, caminho: destino };

    const ext = path.extname(nomeDesejado);
    const base = path.basename(nomeDesejado, ext);
    let i = 1;
    while (await fs.pathExists(destino)) {
        const candidato = `${base} (${i})${ext}`;
        destino = path.join(dir, candidato);
        i++;
    }
    return { nome: path.basename(destino), caminho: destino };
}

async function getCliente(tenant_id, cliente_id) {
    const rows = await executeQuery(
        `SELECT id, nome, cpf_cnpj
       FROM clientes
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tenant_id, cliente_id]
    );
    return rows[0] || null;
}

async function getUsuarioById(tenant_id, user_id) {
    if (!user_id) return null;
    const rows = await executeQuery(
        `SELECT id, nome, email
       FROM usuarios
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tenant_id, user_id]
    );
    return rows[0] || null;
}

async function getUsuarioIdByNome(tenant_id, nome) {
    const rows = await executeQuery(
        `SELECT id
       FROM usuarios
      WHERE tenant_id = ? AND TRIM(LOWER(nome)) = TRIM(LOWER(?))
      LIMIT 1`,
        [tenant_id, nome]
    );
    return rows[0]?.id || null;
}

function pastaAcaoFrom(tenant_id, clienteNome, clienteCpfCnpj, titulo) {
    const letraInicial = (clienteNome || 'X').charAt(0).toUpperCase();
    const nomeClienteFormatado = safeFsName(`${clienteNome} ${clienteCpfCnpj || ''}`.trim());
    const tituloFormatado = safeFsName(String(titulo || 'Sem Título'));
    return path.join(BASE_PROCESSOS, String(tenant_id), letraInicial, nomeClienteFormatado, tituloFormatado);
}

/* ============================ CRUD / FS ============================ */

// Criar uma ação nova
exports.criar = async ({
    tenant_id,
    cliente_id,
    designado_id, // pode vir vazio
    titulo,
    status = 'Não iniciado',
    criador_id = null,
    arquivos = [],
    complexidade, // 'Baixa' | 'Média' | 'Alta'
}) => {
    const tId = assertTenant(tenant_id);
    if (!cliente_id) throw new Error('cliente_id é obrigatório');
    if (!titulo) throw new Error('titulo é obrigatório');
    if (!complexidade) throw new Error('complexidade é obrigatória');

    // Buscar cliente (do tenant)
    const cliente = await getCliente(tId, cliente_id);
    if (!cliente) throw new Error('Cliente não encontrado');

    // Buscar designado (se informado)
    let designadoIdFinal = null;
    if (designado_id && designado_id !== 'Nenhum') {
        const d = await getUsuarioById(tId, designado_id);
        if (d) designadoIdFinal = d.id;
    }

    // Pasta do processo (por tenant + cliente + título)
    const pastaAcao = pastaAcaoFrom(tId, cliente.nome, cliente.cpf_cnpj, titulo);
    await ensureDir(pastaAcao);

    // Mover arquivos (com prefixos)
    for (const arquivo of arquivos) {
        let prefixo = '';
        if (arquivo.fieldname === 'contratoArquivo') prefixo = 'CON - ';
        else if (arquivo.fieldname === 'procuracaoArquivo') prefixo = 'PRO - ';
        else if (arquivo.fieldname === 'declaracaoArquivo') prefixo = 'DEC - ';
        else if (arquivo.fieldname === 'fichaArquivo') prefixo = 'FIC - ';
        else if (arquivo.fieldname === 'documentacaoArquivo') prefixo = 'DOC - ';
        else if (arquivo.fieldname === 'provasArquivo') prefixo = 'PROV - ';
        else if (arquivo.fieldname === 'acaoArquivo') prefixo = 'ACAO - ';

        const nomeDesejado = prefixo + arquivo.originalname;
        const { caminho } = await gerarNomeUnico(pastaAcao, nomeDesejado);
        await fs.move(arquivo.path, caminho);
    }

    // Inserir ação
    const result = await executeQuery(
        `INSERT INTO acoes
      (tenant_id, cliente_id, titulo, complexidade, designado_id, criador_id, status, arquivo_path, data_criacao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [tId, cliente.id, titulo, complexidade, designadoIdFinal, criador_id ?? null, status, pastaAcao]
    );

    return { id: result.insertId, pasta: pastaAcao };
};

// Upload adicional
exports.uploadArquivo = async ({ tenant_id, acao_id, arquivo, prefixo }) => {
    const tId = assertTenant(tenant_id);

    const rows = await executeQuery(
        `SELECT id, tenant_id, cliente_id, titulo, arquivo_path
       FROM acoes
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tId, acao_id]
    );
    const acao = rows[0];
    if (!acao) throw new Error('Ação não encontrada');

    // Garantir pasta (reconstroi se vazio)
    let pastaAcao = acao.arquivo_path;
    if (!pastaAcao) {
        const cliente = await getCliente(tId, acao.cliente_id);
        if (!cliente) throw new Error('Cliente não encontrado');
        pastaAcao = pastaAcaoFrom(tId, cliente.nome, cliente.cpf_cnpj, acao.titulo);
        await ensureDir(pastaAcao);
        await executeQuery('UPDATE acoes SET arquivo_path = ? WHERE tenant_id = ? AND id = ?', [pastaAcao, tId, acao_id]);
    } else {
        await ensureDir(pastaAcao);
    }

    // Nome único
    let nomeArquivo = `${prefixo} - ${arquivo.originalname}`;
    const { caminho } = await gerarNomeUnico(pastaAcao, nomeArquivo);
    nomeArquivo = path.basename(caminho);

    await fs.move(arquivo.path, caminho);
    // (arquivo_path já aponta para a pasta; não salvamos o arquivo individual na base)
    return { nome: nomeArquivo, caminho };
};

// Remover arquivo
exports.removerArquivo = async ({ tenant_id, acaoId, nomeArquivo }) => {
    const tId = assertTenant(tenant_id);

    const rows = await executeQuery(
        `SELECT arquivo_path
       FROM acoes
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tId, acaoId]
    );
    const acao = rows[0];
    if (!acao) throw new Error('Ação não encontrada');

    const caminho = path.join(acao.arquivo_path || '', nomeArquivo);
    if (acao.arquivo_path && (await fs.pathExists(caminho))) {
        await fs.remove(caminho);
        return true;
    }
    throw new Error('Arquivo não encontrado');
};

// Listar ações (com filtro opcional de status) — retorna nomes já resolvidos
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
      a.arquivo_path,
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

// Aprovar ação
exports.aprovar = (tenant_id, id) => {
    const tId = assertTenant(tenant_id);
    return executeQuery(
        `UPDATE acoes SET data_aprovado = NOW() WHERE tenant_id = ? AND id = ?`,
        [tId, id]
    );
};

// Buscar status (retorna também nome do designado)
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

// Atualizar status/designado/complexidade
exports.updateStatus = async (tenant_id, id, { status, designado, complexidade }) => {
    const tId = assertTenant(tenant_id);

    const sets = [];
    const params = [];

    if (status !== undefined) {
        sets.push('status = ?');
        params.push(status);
        // regras de data_concluido conforme enum usado
        const st = String(status || '').toLowerCase();
        if (st === 'concluído' || st === 'concluido' || st === 'aprovado' || st === 'protocolado') {
            sets.push('data_concluido = IFNULL(data_concluido, NOW())');
        } else if (st === 'em andamento' || st === 'não iniciado' || st === 'nao iniciado' || st === 'devolvido') {
            sets.push('data_concluido = NULL');
        }
    }

    // 'designado' pode ser id numérico ou nome
    if (designado !== undefined) {
        let desigId = null;
        if (designado === null || designado === '' || String(designado).toLowerCase() === 'nenhum') {
            desigId = null;
        } else if (/^\d+$/.test(String(designado))) {
            desigId = Number(designado);
            // opcional: validar que existe no tenant
            const u = await getUsuarioById(tId, desigId);
            if (!u) {
                const err = new Error('Designado não encontrado');
                err.status = 400;
                throw err;
            }
        } else {
            // veio nome
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

// Listar arquivos de uma ação (por prefixo)
exports.listarArquivos = async (tenant_id, id) => {
    const tId = assertTenant(tenant_id);

    const rows = await executeQuery(
        `SELECT arquivo_path, designado_id
       FROM acoes
      WHERE tenant_id = ? AND id = ?
      LIMIT 1`,
        [tId, id]
    );
    const acao = rows[0];

    if (!acao || !acao.arquivo_path || !(await fs.pathExists(acao.arquivo_path))) {
        // retorna estrutura vazia mantendo a compat esperada pelo frontend
        let designadoNome = 'Nenhum';
        if (acao?.designado_id) {
            const u = await getUsuarioById(tId, acao.designado_id);
            if (u?.nome) designadoNome = u.nome;
        }
        return {
            Contrato: [],
            Procuracao: [],
            Declaracao: [],
            Ficha: [],
            Documentacao: [],
            Provas: [],
            Acao: [],
            __designadoAtual: designadoNome,
        };
    }

    const arquivos = await fs.readdir(acao.arquivo_path);
    const lista = arquivos.map((nome) => ({ nome, path: path.join(acao.arquivo_path, nome) }));

    let designadoNome = 'Nenhum';
    if (acao.designado_id) {
        const u = await getUsuarioById(tId, acao.designado_id);
        if (u?.nome) designadoNome = u.nome;
    }

    return {
        Contrato: lista.filter((a) => a.nome.startsWith('CON - ')),
        Procuracao: lista.filter((a) => a.nome.startsWith('PRO - ')),
        Declaracao: lista.filter((a) => a.nome.startsWith('DEC - ')),
        Ficha: lista.filter((a) => a.nome.startsWith('FIC - ')),
        Documentacao: lista.filter((a) => a.nome.startsWith('DOC - ')),
        Provas: lista.filter((a) => a.nome.startsWith('PROV - ')),
        Acao: lista.filter((a) => a.nome.startsWith('ACAO - ')),
        __designadoAtual: designadoNome,
    };
};

// Salvar comentário
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

// Minhas ações (designadas ao usuário logado)
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
        a.arquivo_path,
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

// Atualizar status (restrito ao designado logado)
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
