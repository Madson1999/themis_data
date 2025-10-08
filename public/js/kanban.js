/* ========================================================================
* KANBAN – Lado do cliente (cards, drag & drop e modal de arquivos)
* Padrões de comentário:
*   - Cabeçalho da seção:  ====== SEÇÃO ======
*   - Cabeçalho de função: /** Função: o que faz  *\/
*   - Comentários de linha: // Explicação curta
* ===================================================================== */

/* ====== CONSTANTES E ESTADO ====== */
const COLS = {
    'Não iniciado': document.getElementById('col-nao-iniciado'),
    'Em andamento': document.getElementById('col-andamento'),
    'Finalizado': document.getElementById('col-finalizado'),
};
const STATUS_VALIDOS = Object.keys(COLS);
const tpl = document.getElementById('tpl-card');
let draggedId = null;

/* ====== MULTI-TENANT: helper para enviar X-Tenant-Id ====== */
const TENANT_ID = localStorage.getItem('tenant_id') || '1';

/** fetchTenant: wrapper de fetch que injeta o cabeçalho X-Tenant-Id */
function fetchTenant(url, options = {}) {
    const base = options || {};
    const headers = new Headers(base.headers || {});
    headers.set('X-Tenant-Id', TENANT_ID);

    return fetch(url, {
        credentials: 'same-origin',
        ...base,
        headers
    });
}

/* ====== MODAL (ESTADO E REFERÊNCIAS) ====== */
let MODAL = {
    el: null,            // backdrop do modal
    titleEl: null,       // título (h2)
    closeBtn: null,      // botão fechar (X)
    uploadArea: null,    // área de upload (drag&drop)
    fileInput: null,     // <input type="file" multiple>
    progress: null,      // barra de progresso (wrapper)
    bar: null,           // barra de progresso (preenchimento)
    list: null,          // lista de arquivos
    currentActionId: null,
    currentActionTitle: '',
    currentActionStatus: ''
};

/* ========================================================================
 * UTILITÁRIOS
 * ===================================================================== */

/** isReadOnlyStatus: retorna true se o status for somente leitura */
function isReadOnlyStatus(status) {
    const s = String(status || '').trim().toLowerCase();
    return s === 'finalizado';
}

/** formatDate: formata ISO para dd/mm/aaaa hh:mm (pt-BR) */
function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return (
        d.toLocaleDateString('pt-BR') +
        ' ' +
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    );
}

/** extractComment: tenta encontrar o comentário em várias formas de resposta */
function extractComment(payload) {
    // candidatos de chaves
    const KEYS = ['comentario', 'comentário', 'comment', 'observacao', 'observação', 'nota', 'justificativa', 'retorno'];
    // tenta direto
    for (const k of KEYS) {
        if (typeof payload?.[k] === 'string') return payload[k];
    }
    // wrappers comuns
    const wrappers = ['data', 'acao', 'result', 'item'];
    for (const w of wrappers) {
        const obj = payload?.[w];
        if (obj && typeof obj === 'object') {
            for (const k of KEYS) {
                if (typeof obj?.[k] === 'string') return obj[k];
            }
        }
    }
    // array como resposta
    if (Array.isArray(payload) && payload.length) {
        for (const k of KEYS) {
            if (typeof payload[0]?.[k] === 'string') return payload[0][k];
        }
    }
    return '';
}

/* ========================================================================
 * KANBAN – CARDS E RENDERIZAÇÃO
 * ===================================================================== */

/** buildCard: cria um card a partir de uma ação */
function buildCard(acao) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.classList.add('kanban-card');
    node.dataset.id = acao.id;
    node.dataset.status = acao.status || '';
    // guarda comentário (se vier do backend já na listagem)
    node.dataset.comment = String(acao.comentario || acao.comment || acao.observacao || '').trim();

    // Conteúdo do card
    node.querySelector('.card-title').textContent = acao.titulo || '(sem título)';
    node.querySelector('.card-protocolo').textContent = acao.protocolo ? `#${acao.protocolo}` : '';
    node.querySelector('.card-cliente').textContent = acao.cliente || '';
    node.querySelector('.card-criador').textContent = acao.criador ? `Criado por: ${acao.criador}` : '';
    node.querySelector('.card-data').textContent = acao.data_criacao ? formatDate(acao.data_criacao) : '';

    // Drag habilitado/desabilitado conforme status
    const ro = isReadOnlyStatus(acao.status);
    node.setAttribute('draggable', ro ? 'false' : 'true');
    if (ro) node.style.opacity = '.85';

    // Eventos de drag com classe .dragging (permite distinguir clique vs arrasto)
    node.addEventListener('dragstart', (e) => {
        if (isReadOnlyStatus(node.dataset.status)) {
            e.preventDefault();
            return;
        }
        draggedId = node.dataset.id;
        e.dataTransfer.setData('text/plain', draggedId);
        node.classList.add('dragging');
    });
    node.addEventListener('dragend', () => {
        node.classList.remove('dragging');
    });

    // Abrir modal ao clicar no card (se não for arrasto)
    attachOpenModalOnCard(node, acao);

    return node;
}

/** renderKanban: distribui cards nas colunas por status */
function renderKanban(acoes) {
    for (const col of Object.values(COLS)) col.innerHTML = '';
    for (const acao of acoes) {
        const status = STATUS_VALIDOS.includes(acao.status) ? acao.status : 'Não iniciado';
        COLS[status].appendChild(buildCard(acao));
    }
}

/** loadMyAcoes: busca ações do usuário logado e renderiza o kanban */
async function loadMyAcoes() {
    const res = await fetchTenant('/api/acoes/mine');
    if (!res.ok) throw new Error('Falha ao carregar ações');
    const acoes = await res.json();
    renderKanban(acoes);
}

/** updateStatus: altera o status de uma ação no servidor */
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

/* ====== DROP TARGETS: colunas aceitam cards arrastados ====== */
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
            const card = document.querySelector(`.kanban-card[data-id="${id}"]`);
            if (card) {
                card.dataset.status = status;
                colList.appendChild(card);
            }
        } catch (err) {
            alert('Não foi possível mover a ação: ' + err.message);
        } finally {
            draggedId = null;
        }
    });
}

/* ========================================================================
 * MODAL – REFERÊNCIAS, ABRIR/FECHAR, COMENTÁRIO E ARQUIVOS
 * ===================================================================== */

/** initModalRefs: captura referências do DOM do modal */
function initModalRefs() {
    MODAL.el = document.getElementById('modal-backdrop');
    MODAL.titleEl = document.getElementById('modal-title');
    MODAL.closeBtn = document.getElementById('modal-close');
    MODAL.uploadArea = document.getElementById('upload-area');
    MODAL.fileInput = document.getElementById('file-input');
    MODAL.progress = document.getElementById('upload-progress');
    MODAL.bar = MODAL.progress.firstElementChild;
    MODAL.list = document.getElementById('file-list');

    // Avisos de elementos faltando (ajuda a detectar por que o banner não aparece)
    if (!MODAL.uploadArea) console.warn('[KANBAN] #upload-area não encontrado, banner será inserido no título.');
}

/** openModal: abre o modal, exibe comentário (se houver) e lista arquivos */
function openModal(actionId, actionTitle, actionStatus, initialComment = '') {
    MODAL.currentActionId = actionId;
    MODAL.currentActionTitle = actionTitle || '';
    MODAL.currentActionStatus = actionStatus || '';

    const safeTitle = (actionTitle || '').trim();
    MODAL.titleEl.textContent = `Arquivos – ${safeTitle || 'Ação #' + actionId}`;

    MODAL.el.classList.add('open');
    MODAL.el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Bloqueio visual da área de upload, se status for somente leitura
    const ro = isReadOnlyStatus(MODAL.currentActionStatus);
    MODAL.uploadArea?.classList.toggle('disabled', ro);

    // 1) Mostra comentário imediatamente se veio do card
    if (initialComment && initialComment.trim()) {
        console.debug('[KANBAN] Comentário inicial do card:', initialComment);
        renderCommentBanner(initialComment.trim());
    } else {
        removeCommentBanner();
    }

    // 2) Busca comentário mais recente no backend
    loadActionComment(actionId).catch((e) => {
        console.error('[KANBAN] Erro ao carregar comentário:', e);
    });

    // 3) Carrega listagem de arquivos
    loadFilesForAction(actionId).catch(console.error);
}

/** closeModal: fecha modal e limpa itens/progresso */
function closeModal() {
    MODAL.el.classList.remove('open');
    MODAL.el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    MODAL.currentActionId = null;
    MODAL.list.innerHTML = '';
    removeCommentBanner();
    resetProgress();
}

/** resetProgress: esconde e zera barra de progresso */
function resetProgress() {
    MODAL.progress.style.display = 'none';
    MODAL.bar.style.width = '0%';
}

/** loadActionComment: busca detalhe da ação para obter 'comentario' */
async function loadActionComment(actionId) {
    let res;
    try {
        res = await fetchTenant(`/api/acoes/${actionId}`, {
            headers: { 'Accept': 'application/json' }
        });
    } catch (e) {
        console.error('[KANBAN] Falha no fetch primário:', e);
    }

    if (!res || !res.ok) {
        try {
            res = await fetchTenant(`/api/acoes/detalhes/${actionId}`, {
                headers: { 'Accept': 'application/json' }
            });
        } catch (e) {
            console.error('[KANBAN] Falha no fetch fallback:', e);
        }
    }

    if (!res || !res.ok) {
        console.warn('[KANBAN] Não foi possível obter comentário (resposta inválida).');
        return;
    }

    const data = await res.json().catch(() => null);
    const comentario = String(extractComment(data) || '').trim();
    console.debug('[KANBAN] Comentário do backend extraído:', comentario);

    if (comentario) renderCommentBanner(comentario);
    else removeCommentBanner();
}

/** getBannerContainer: define onde inserir o banner de comentário */
function getBannerContainer() {
    // tenta inserir antes de #upload-area
    if (MODAL.uploadArea?.parentElement) return { parent: MODAL.uploadArea.parentElement, before: MODAL.uploadArea };
    // fallback: container próximo ao título
    const fallbackParent = MODAL.titleEl?.parentElement || MODAL.el;
    return { parent: fallbackParent, before: fallbackParent?.lastChild || null };
}

/** renderCommentBanner: insere banner de comentário */
function renderCommentBanner(texto) {
    removeCommentBanner(); // garante único banner

    const banner = document.createElement('div');
    banner.id = 'comment-banner';
    banner.setAttribute('role', 'note');
    banner.style.cssText = `
    margin: 12px 0 6px; padding: 12px;
    border: 1px solid #f59e0b; background: #fffbeb; color: #7c2d12;
    border-radius: 10px; display: flex; gap: 10px; align-items: flex-start;
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
    btn.addEventListener('click', async () => {
        // (Opcional) Chamar backend para marcar como lido
        // await fetchTenant(`/api/acoes/${MODAL.currentActionId}/comentario-lido`, { method: 'POST' });
        removeCommentBanner();
    });

    const { parent, before } = getBannerContainer();
    if (!parent) {
        console.warn('[KANBAN] Não achei container para inserir o banner.');
        return;
    }

    const wrap = document.createElement('div');
    wrap.style.width = '100%';
    wrap.appendChild(icon);
    wrap.appendChild(content);
    wrap.appendChild(actions);
    banner.appendChild(wrap);

    parent.insertBefore(banner, before);
}

/** removeCommentBanner: remove o banner de comentário se existir */
function removeCommentBanner() {
    const banner = document.getElementById('comment-banner');
    if (banner) banner.remove();
}

/* ========================================================================
 * ARQUIVOS – LISTAGEM, RENDERIZAÇÃO E EXCLUSÃO
 * ===================================================================== */

/** loadFilesForAction: lista arquivos agrupados e renderiza itens */
async function loadFilesForAction(actionId) {
    MODAL.list.innerHTML = '<div style="color:#64748b">Carregando…</div>';
    try {
        const res = await fetchTenant(`/api/acoes/arquivos/${actionId}`);
        if (!res.ok) throw new Error('Falha ao listar arquivos');

        // Esperado: {Contrato:[], Procuracao:[], Declaracao:[], Ficha:[], Documentacao:[], Provas:[], Acao:[]}
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

/** renderFileItem: cria item de arquivo (download e excluir quando permitido) */
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

    // Dica de tipo (prefixo antes de " - ")
    const tipo = (f.nome || '').split(' - ')[0]; // "ACAO", "CON", "DOC", "PROV"
    const hint = document.createElement('small');
    hint.style.color = '#64748b';
    hint.textContent = tipo ? `Tipo: ${tipo}` : '';
    left.appendChild(hint);

    div.appendChild(left);

    // Excluir somente quando começa com "ACAO - " e não estiver read-only
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

/** setupUploadArea: registra eventos do input e do drag&drop */
function setupUploadArea() {
    const area = MODAL.uploadArea;

    // Input de arquivo
    MODAL.fileInput.addEventListener('change', async (e) => {
        if (!e.target.files?.length) return;
        await uploadFiles(e.target.files);
        MODAL.fileInput.value = '';
    });

    // Drag-over/enter (realce)
    ['dragenter', 'dragover'].forEach((evt) => {
        area.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            area.classList.add('dragover');
        });
    });

    // Drag-leave/drop (remove realce)  **(corrigido)**
    ['dragleave', 'drop'].forEach((evt) => {
        area.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            area.classList.remove('dragover');
        });
    });

    // Drop de arquivos
    area.addEventListener('drop', async (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length) await uploadFiles(files);
    });
}

/** uploadFiles: envia arquivos um a um com progresso */
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
            MODAL.progress.style.display = 'block';
            MODAL.bar.style.width = pct + '%';
        });
        resetProgress();
    }
    await loadFilesForAction(MODAL.currentActionId);
}

/** xhrUpload: faz upload via XMLHttpRequest permitindo acompanhar progresso */
function xhrUpload(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.withCredentials = true;
        // MULTI-TENANT: envia o cabeçalho também no XHR de upload
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
 * INTERAÇÕES – CLICK NO CARD E INICIALIZAÇÃO
 * ===================================================================== */

/** attachOpenModalOnCard: abre modal ao clicar no card (evita clique durante arrasto) */
function attachOpenModalOnCard(node, acao) {
    node.addEventListener('click', (ev) => {
        if (ev.target.closest('.dragging')) return; // evita clique vindo de arrasto
        // passa o comentário do dataset (se houver) para exibir instantaneamente
        openModal(acao.id, acao.titulo, acao.status, node.dataset.comment || '');
    });
}

/** Inicialização: carrega kanban, prepara modal e atalhos */
document.addEventListener('DOMContentLoaded', async () => {
    // 1) Carregar kanban
    try {
        await loadMyAcoes();
    } catch (e) {
        console.error(e);
        alert('Erro ao carregar Kanban: ' + e.message);
    }

    // 2) Iniciar modal + upload + atalhos de fechamento
    initModalRefs();
    setupUploadArea();

    // Fechar clicando fora
    MODAL.el.addEventListener('click', (e) => {
        if (e.target === MODAL.el) closeModal();
    });
    // Fechar no X
    MODAL.closeBtn.addEventListener('click', closeModal);
    // Fechar com Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && MODAL.el.classList.contains('open')) closeModal();
    });
});
