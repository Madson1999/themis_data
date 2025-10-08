/**
 * public/js/kanban.js
 * ----------------------------------------
 * Kanban do módulo Ações — SaaS multi-tenant.
 *
 * RESUMO
 * - Renderiza cards por status: "Não iniciado", "Em andamento", "Finalizado".
 * - Oculta ações com status "Aprovado" (não aparecem no board).
 * - Atualização em tempo real sem F5 (polling 5s + sync ao ganhar foco).
 * - Drag & Drop com persistência (PATCH /api/acoes/:id/status).
 * - Modal de arquivos (listar, baixar, upload com progresso, excluir quando permitido).
 * - Todas as requisições enviam o cabeçalho X-Tenant-Id.
 *
 * CONVENÇÕES DE COMENTÁRIO
 * - Seções:        ====== NOME DA SEÇÃO ======
 * - Funções:       /** Função: descrição sucinta *\/
 * - Comentários:   // explicação curta
 *
 * DEPENDÊNCIAS DE DOM
 * - Template:      #tpl-card
 * - Colunas:       #col-nao-iniciado, #col-andamento, #col-finalizado
 * - Modal:         #modal-backdrop, #modal-title, #modal-close,
 *                  #upload-area, #file-input, #upload-progress (div>div), #file-list
 *
 * ENDPOINTS UTILIZADOS
 * - GET    /api/acoes/mine                 -> listar ações do usuário
 * - PATCH  /api/acoes/:id/status           -> alterar status da ação
 * - GET    /api/acoes/:id                  -> detalhes (comentário)
 * - GET    /api/acoes/detalhes/:id         -> fallback de detalhes (comentário)
 * - GET    /api/acoes/arquivos/:id         -> listar arquivos por grupos
 * - POST   /api/acoes/upload-acao          -> upload (FormData/XHR + progresso)
 * - POST   /api/acoes/remover-arquivo      -> remover arquivo (apenas "ACAO - *")
 *
 * REGRAS DE UI
 * - "Finalizado": somente leitura (sem drag; upload desabilitado).
 * - "Aprovado": oculto no board (hidden).
 * - Reconciliação incremental: adiciona/atualiza/remove cards sem recarregar.
 *
 * REALTIME
 * - Polling: 5000 ms (ajustável) + sincronização imediata ao focar a aba.
 * - Hook preparado para SSE (/api/acoes/stream) — desativado por padrão.
 *
 * SEGURANÇA / MULTI-TENANT
 * - X-Tenant-Id obtido de localStorage('tenant_id') ou '1' (fallback).
 * - fetch com credentials: 'same-origin'.
 *
 */


/* ====== CONSTANTES E ESTADO ====== */
const COLS = {
    'Não iniciado': document.getElementById('col-nao-iniciado'),
    'Em andamento': document.getElementById('col-andamento'),
    'Finalizado': document.getElementById('col-finalizado'),
};
const STATUS_VALIDOS = Object.keys(COLS);
const tpl = document.getElementById('tpl-card');
let draggedId = null;

/* Multi-tenant */
const TENANT_ID = localStorage.getItem('tenant_id') || '1';

/* Helpers de normalização e aprovação por data_aprovado */
const norm = (s) => String(s || '').trim().toLowerCase();
const hasDate = (v) => {
    const s = String(v ?? '').trim().toLowerCase();
    return !!s && s !== 'null' && s !== 'undefined';
};
/** Uma ação é "aprovada" quando possui data_aprovado preenchida */
const isApproved = (acao) => hasDate(acao?.data_aprovado);

/* Atualização em tempo real */
const SYNC_INTERVAL_MS = 5000; // 5s – ajuste se quiser
let syncTimer = null;

/* Índices locais: espelho do DOM/servidor */
const cardIndex = new Map();   // id -> HTMLElement (card)
const dataIndex = new Map();   // id -> objeto ação (última visão)


/* ========================================================================
 * FETCH helper (injeta cabeçalho X-Tenant-Id)
 * ===================================================================== */
function fetchTenant(url, options = {}) {
    const base = options || {};
    const headers = new Headers(base.headers || {});
    headers.set('X-Tenant-Id', TENANT_ID);
    return fetch(url, { credentials: 'same-origin', ...base, headers });
}

/* ========================================================================
 * UTILITÁRIOS
 * ===================================================================== */
function isReadOnlyStatus(status) {
    return norm(status) === 'finalizado';
}

function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return (
        d.toLocaleDateString('pt-BR') +
        ' ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    );
}

function extractComment(payload) {
    const KEYS = ['comentario', 'comentário', 'comment', 'observacao', 'observação', 'nota', 'justificativa', 'retorno'];
    for (const k of KEYS) if (typeof payload?.[k] === 'string') return payload[k];
    const wrappers = ['data', 'acao', 'result', 'item'];
    for (const w of wrappers) {
        const obj = payload?.[w];
        if (obj && typeof obj === 'object') {
            for (const k of KEYS) if (typeof obj?.[k] === 'string') return obj[k];
        }
    }
    if (Array.isArray(payload) && payload.length) {
        for (const k of KEYS) if (typeof payload[0]?.[k] === 'string') return payload[0][k];
    }
    return '';
}

/* ========================================================================
 * KANBAN – CONSTRUÇÃO DE CARDS / RENDER
 * ===================================================================== */
function buildCard(acao) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.classList.add('kanban-card');
    node.dataset.id = acao.id;
    node.dataset.status = acao.status || '';
    node.dataset.comment = String(acao.comentario || acao.comment || acao.observacao || '').trim();

    node.querySelector('.card-title').textContent = acao.titulo || '(sem título)';
    node.querySelector('.card-protocolo').textContent = acao.protocolo ? `#${acao.protocolo}` : '';
    node.querySelector('.card-cliente').textContent = acao.cliente || '';
    node.querySelector('.card-criador').textContent = acao.criador ? `Criado por: ${acao.criador}` : '';
    node.querySelector('.card-data').textContent = acao.data_criacao ? formatDate(acao.data_criacao) : '';

    const ro = isReadOnlyStatus(acao.status);
    node.setAttribute('draggable', ro ? 'false' : 'true');
    if (ro) node.style.opacity = '.85';

    node.addEventListener('dragstart', (e) => {
        if (isReadOnlyStatus(node.dataset.status)) {
            e.preventDefault();
            return;
        }
        draggedId = node.dataset.id;
        e.dataTransfer.setData('text/plain', draggedId);
        node.classList.add('dragging');
    });
    node.addEventListener('dragend', () => node.classList.remove('dragging'));

    attachOpenModalOnCard(node, acao);
    return node;
}

/* Render inicial (limpa e insere) */
function renderKanban(acoes) {
    for (const col of Object.values(COLS)) col.innerHTML = '';
    cardIndex.clear();
    dataIndex.clear();

    for (const acao of acoes) {
        if (isApproved(acao)) continue; // não mostra aprovadas

        const status = STATUS_VALIDOS.includes(acao.status) ? acao.status : 'Não iniciado';
        const card = buildCard(acao);
        COLS[status].appendChild(card);
        cardIndex.set(String(acao.id), card);
        dataIndex.set(String(acao.id), acao);
    }
}


/* ========================================================================
 * RECONCILIAÇÃO – Atualiza DOM sem recarregar (add/move/update/remove)
 * ===================================================================== */
function reconcileKanban(serverAcoes) {
    const incoming = new Map();
    for (const acao of serverAcoes) incoming.set(String(acao.id), acao);

    // 1) Remover cards que sumiram ou ficaram aprovados
    for (const [id, oldAcao] of dataIndex.entries()) {
        const nova = incoming.get(id);
        if (!nova || isApproved(nova)) {
            removeCard(id);
        }
    }

    // 2) Inserir/atualizar os restantes (não aprovados)
    for (const [id, acao] of incoming.entries()) {
        if (isApproved(acao)) continue;

        const card = cardIndex.get(id);
        if (!card) {
            const novo = buildCard(acao);
            const destino = COLS[STATUS_VALIDOS.includes(acao.status) ? acao.status : 'Não iniciado'];
            destino.appendChild(novo);
            cardIndex.set(id, novo);
            dataIndex.set(id, acao);
            continue;
        }

        const prev = dataIndex.get(id) || {};
        const mudouStatus = norm(prev.status) !== norm(acao.status);
        const mudouTitulo = (prev.titulo || '') !== (acao.titulo || '');
        const mudouCliente = (prev.cliente || '') !== (acao.cliente || '');
        const mudouProtocolo = (prev.protocolo || '') !== (acao.protocolo || '');
        const mudouCriador = (prev.criador || '') !== (acao.criador || '');
        const mudouData = (prev.data_criacao || '') !== (acao.data_criacao || '');
        const mudouComentario =
            norm(String(prev.comentario || prev.comment || prev.observacao || '')) !==
            norm(String(acao.comentario || acao.comment || acao.observacao || ''));

        if (mudouStatus) applyStatusLocally(id, acao.status);

        if (mudouTitulo) card.querySelector('.card-title').textContent = acao.titulo || '(sem título)';
        if (mudouCliente) card.querySelector('.card-cliente').textContent = acao.cliente || '';
        if (mudouProtocolo) card.querySelector('.card-protocolo').textContent = acao.protocolo ? `#${acao.protocolo}` : '';
        if (mudouCriador) card.querySelector('.card-criador').textContent = acao.criador ? `Criado por: ${acao.criador}` : '';
        if (mudouData) card.querySelector('.card-data').textContent = acao.data_criacao ? formatDate(acao.data_criacao) : '';
        if (mudouComentario) card.dataset.comment = String(acao.comentario || acao.comment || acao.observacao || '').trim();

        dataIndex.set(id, acao);
    }
}


function removeCard(id) {
    const el = cardIndex.get(id);
    if (el && el.parentElement) el.parentElement.removeChild(el);
    cardIndex.delete(id);
    dataIndex.delete(id);
}

/* Move/oculta card localmente após mudança de status */
function applyStatusLocally(id, novoStatus) {
    const card = cardIndex.get(String(id)) || document.querySelector(`.kanban-card[data-id="${id}"]`);
    if (!card) return;

    const destino = COLS[STATUS_VALIDOS.includes(novoStatus) ? novoStatus : 'Não iniciado'];
    card.dataset.status = novoStatus;
    destino.appendChild(card);

    const current = dataIndex.get(String(id)) || {};
    dataIndex.set(String(id), { ...current, status: novoStatus });
}


/* ========================================================================
 * API – Listagem e atualização de status
 * ===================================================================== */
async function fetchMyAcoes() {
    const res = await fetchTenant('/api/acoes/mine');
    if (!res.ok) throw new Error('Falha ao carregar ações');
    return res.json();
}

async function updateStatus(id, novoStatus) {
    const res = await fetchTenant(`/api/acoes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus })
    });
    if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error || 'Erro';
        throw new Error(msg);
    }
}

/* ========================================================================
 * DROP TARGETS
 * ===================================================================== */
for (const [status, colList] of Object.entries(COLS)) {
    const col = colList.closest('.kanban-col');

    col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));

    col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');

        const id = draggedId || e.dataTransfer.getData('text/plain');
        if (!id) return;

        try {
            await updateStatus(id, status);
            applyStatusLocally(id, status); // move localmente; remoção ocorrerá se data_aprovado vier no próximo sync
        } catch (err) {
            alert('Não foi possível mover a ação: ' + err.message);
        } finally {
            draggedId = null;
        }
    });
}

/* ========================================================================
 * MODAL – Referências e fluxo
 * ===================================================================== */
let MODAL = {
    el: null,
    titleEl: null,
    closeBtn: null,
    uploadArea: null,
    fileInput: null,
    progress: null,
    bar: null,
    list: null,
    currentActionId: null,
    currentActionTitle: '',
    currentActionStatus: ''
};

function initModalRefs() {
    MODAL.el = document.getElementById('modal-backdrop');
    MODAL.titleEl = document.getElementById('modal-title');
    MODAL.closeBtn = document.getElementById('modal-close');
    MODAL.uploadArea = document.getElementById('upload-area');
    MODAL.fileInput = document.getElementById('file-input');
    MODAL.progress = document.getElementById('upload-progress');
    MODAL.bar = MODAL.progress?.firstElementChild || document.createElement('div');
    MODAL.list = document.getElementById('file-list');

    if (!MODAL.uploadArea) console.warn('[KANBAN] #upload-area não encontrado.');
}

function openModal(actionId, actionTitle, actionStatus, initialComment = '') {
    MODAL.currentActionId = actionId;
    MODAL.currentActionTitle = actionTitle || '';
    MODAL.currentActionStatus = actionStatus || '';

    const safeTitle = (actionTitle || '').trim();
    MODAL.titleEl.textContent = `Arquivos – ${safeTitle || 'Ação #' + actionId}`;

    MODAL.el.classList.add('open');
    MODAL.el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const ro = isReadOnlyStatus(MODAL.currentActionStatus);
    MODAL.uploadArea?.classList.toggle('disabled', ro);

    if (initialComment && initialComment.trim()) renderCommentBanner(initialComment.trim());
    else removeCommentBanner();

    loadActionComment(actionId).catch(console.error);
    loadFilesForAction(actionId).catch(console.error);
}

function closeModal() {
    MODAL.el.classList.remove('open');
    MODAL.el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    MODAL.currentActionId = null;
    MODAL.list.innerHTML = '';
    removeCommentBanner();
    resetProgress();
}

function resetProgress() {
    if (!MODAL.progress) return;
    MODAL.progress.style.display = 'none';
    if (MODAL.bar) MODAL.bar.style.width = '0%';
}

async function loadActionComment(actionId) {
    let res;
    try {
        res = await fetchTenant(`/api/acoes/${actionId}`, { headers: { 'Accept': 'application/json' } });
    } catch (e) { /* ignore */ }

    if (!res || !res.ok) {
        try {
            res = await fetchTenant(`/api/acoes/detalhes/${actionId}`, { headers: { 'Accept': 'application/json' } });
        } catch (e) { /* ignore */ }
    }
    if (!res || !res.ok) return;

    const data = await res.json().catch(() => null);
    const comentario = String(extractComment(data) || '').trim();
    if (comentario) renderCommentBanner(comentario);
    else removeCommentBanner();
}

function getBannerContainer() {
    if (MODAL.uploadArea?.parentElement) return { parent: MODAL.uploadArea.parentElement, before: MODAL.uploadArea };
    const fallbackParent = MODAL.titleEl?.parentElement || MODAL.el;
    return { parent: fallbackParent, before: fallbackParent?.lastChild || null };
}

function renderCommentBanner(texto) {
    removeCommentBanner();
    const banner = document.createElement('div');
    banner.id = 'comment-banner';
    banner.setAttribute('role', 'note');
    banner.style.cssText = `
    margin:12px 0 6px; padding:12px;
    border:1px solid #f59e0b; background:#fffbeb; color:#7c2d12;
    border-radius:10px; display:flex; gap:10px; align-items:flex-start;
  `;

    const icon = document.createElement('span');
    icon.textContent = '📝';
    icon.style.fontSize = '18px';

    const content = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = 'Comentário do advogado';
    title.style.cssText = 'font-weight:600; margin-bottom:4px;';
    const body = document.createElement('div');
    body.textContent = texto;

    content.appendChild(title);
    content.appendChild(body);

    const actions = document.createElement('div');
    actions.style.marginLeft = 'auto';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Marcar como lido';
    btn.style.cssText = `
    background:#fff; border:1px solid #f59e0b; color:#92400e;
    padding:6px 10px; border-radius:8px; cursor:pointer;
  `;
    btn.addEventListener('click', () => removeCommentBanner());

    const { parent, before } = getBannerContainer();
    if (!parent) return;

    const wrap = document.createElement('div');
    wrap.style.width = '100%';
    wrap.appendChild(icon);
    wrap.appendChild(content);
    wrap.appendChild(actions);
    banner.appendChild(wrap);

    parent.insertBefore(banner, before);
}

function removeCommentBanner() {
    const banner = document.getElementById('comment-banner');
    if (banner) banner.remove();
}

/* ========================================================================
 * ARQUIVOS – LISTA/RENDER/EXCLUIR
 * ===================================================================== */
async function loadFilesForAction(actionId) {
    MODAL.list.innerHTML = '<div style="color:#64748b">Carregando…</div>';
    try {
        const res = await fetchTenant(`/api/acoes/arquivos/${actionId}`);
        if (!res.ok) throw new Error('Falha ao listar arquivos');

        const grupos = await res.json();
        const flat = []
            .concat(
                (grupos.Contrato || []).map(x => ({ nome: x.nome, tipo: 'Contrato' })),
                (grupos.Procuracao || []).map(x => ({ nome: x.nome, tipo: 'Procuracao' })),
                (grupos.Declaracao || []).map(x => ({ nome: x.nome, tipo: 'Declaracao' })),
                (grupos.Ficha || []).map(x => ({ nome: x.nome, tipo: 'Ficha' })),
                (grupos.Documentacao || []).map(x => ({ nome: x.nome, tipo: 'Documentacao' })),
                (grupos.Provas || []).map(x => ({ nome: x.nome, tipo: 'Provas' })),
                (grupos.Acao || []).map(x => ({ nome: x.nome, tipo: 'Acao' })),
            );

        if (flat.length === 0) {
            MODAL.list.innerHTML = '<div style="color:#64748b">Nenhum arquivo enviado.</div>';
            return;
        }

        MODAL.list.innerHTML = '';
        for (const f of flat) {
            const item = {
                nome: f.nome,
                url: `/api/protocolacao/${actionId}/arquivo?nome=${encodeURIComponent(f.nome)}`
            };
            MODAL.list.appendChild(renderFileItem(item));
        }
    } catch (e) {
        MODAL.list.innerHTML = `<div style="color:#b91c1c">Erro: ${e.message}</div>`;
    }
}

function renderFileItem(f) {
    const div = document.createElement('div');
    div.className = 'file-item';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.flexDirection = 'column';

    const a = document.createElement('a');
    a.href = f.url || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = f.nome || f.filename || 'arquivo';
    left.appendChild(a);

    const tipo = (f.nome || '').split(' - ')[0];
    const hint = document.createElement('small');
    hint.style.color = '#64748b';
    hint.textContent = tipo ? `Tipo: ${tipo}` : '';
    left.appendChild(hint);

    div.appendChild(left);

    const podeExcluir = (f.nome || '').startsWith('ACAO - ')
        && !isReadOnlyStatus(MODAL.currentActionStatus);

    if (podeExcluir) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Excluir';
        btn.addEventListener('click', async () => {
            if (!confirm('Remover este arquivo?')) return;
            try {
                const res = await fetchTenant('/api/acoes/remover-arquivo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ acaoId: MODAL.currentActionId, nomeArquivo: f.nome })
                });
                if (!res.ok) throw new Error('Falha ao remover');
                div.remove();
                if (!MODAL.list.children.length) {
                    MODAL.list.innerHTML = '<div style="color:#64748b">Nenhum arquivo enviado.</div>';
                }
            } catch (err) {
                alert('Erro ao excluir: ' + err.message);
            }
        });
        div.appendChild(btn);
    }

    return div;
}

/* ========================================================================
 * UPLOAD – INPUT, DRAG&DROP E PROGRESSO
 * ===================================================================== */
function setupUploadArea() {
    const area = MODAL.uploadArea;
    if (!area) return;

    MODAL.fileInput?.addEventListener('change', async (e) => {
        if (!e.target.files?.length) return;
        await uploadFiles(e.target.files);
        MODAL.fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => {
        area.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            area.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach((evt) => {
        area.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            area.classList.remove('dragover');
        });
    });

    area.addEventListener('drop', async (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length) await uploadFiles(files);
    });
}

async function uploadFiles(fileList) {
    if (!MODAL.currentActionId) return;

    if (isReadOnlyStatus(MODAL.currentActionStatus)) {
        alert('Esta ação está Finalizado. Uploads estão bloqueados.');
        return;
    }

    for (const file of fileList) {
        const fd = new FormData();
        fd.append('acao_id', MODAL.currentActionId);
        fd.append('arquivo', file);

        await xhrUpload('/api/acoes/upload-acao', fd, (pct) => {
            if (MODAL.progress && MODAL.bar) {
                MODAL.progress.style.display = 'block';
                MODAL.bar.style.width = pct + '%';
            }
        });
        resetProgress();
    }
    await loadFilesForAction(MODAL.currentActionId);
}

function xhrUpload(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.withCredentials = true;
        try { xhr.setRequestHeader('X-Tenant-Id', TENANT_ID); } catch (_) { }

        xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress?.(pct);
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
            else {
                try {
                    const json = JSON.parse(xhr.responseText || '{}');
                    reject(new Error(json.error || json.mensagem || 'Falha no upload'));
                } catch {
                    reject(new Error('Falha no upload'));
                }
            }
        };
        xhr.onerror = () => reject(new Error('Erro de rede no upload'));
        xhr.send(formData);
    });
}

/* ========================================================================
 * INTERAÇÕES – Clique no card / Inicialização
 * ===================================================================== */
function attachOpenModalOnCard(node, acao) {
    node.addEventListener('click', (ev) => {
        if (ev.target.closest('.dragging')) return;
        openModal(acao.id, acao.titulo, acao.status, node.dataset.comment || '');
    });
}

/* ========================================================================
 * SYNC – Loop de sincronização sem F5
 * ===================================================================== */
async function fullSync() {
    try {
        const acoes = await fetchMyAcoes();
        if (dataIndex.size === 0 && cardIndex.size === 0) {
            renderKanban(acoes);
        } else {
            reconcileKanban(acoes);
        }
    } catch (e) {
        console.error('[KANBAN] Sync falhou:', e);
    }
}

function startPolling() {
    stopPolling();
    syncTimer = setInterval(fullSync, SYNC_INTERVAL_MS);
}

function stopPolling() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}

/* ========================================================================
 * BOOTSTRAP
 * ===================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    // 1) Carrega e renderiza
    await fullSync();

    // 2) Inicia modal + upload + atalhos
    initModalRefs();
    setupUploadArea();

    // Fechar clicando fora
    MODAL.el?.addEventListener('click', (e) => {
        if (e.target === MODAL.el) closeModal();
    });
    // Fechar no X
    MODAL.closeBtn?.addEventListener('click', closeModal);
    // Fechar com Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && MODAL.el?.classList.contains('open')) closeModal();
    });

    // 3) Loop de sincronização
    startPolling();
    // startSSE(); // habilite quando houver endpoint SSE

    // 4) Sincroniza imediatamente quando a aba ganha foco
    window.addEventListener('focus', () => {
        fullSync(); // atualização instantânea ao voltar para a aba
    });
});
