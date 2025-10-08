/**
 * public/js/acoes.js
 * ----------------------------------------
 * Frontend de Ações (Kanban) — SaaS multi-tenant.
 *
 * - Envia sempre o cabeçalho `x-tenant-id` (cookie `tenant_id`)
 * - Kanban: acompanhar/corrigir
 * - Criação de ação com múltiplos uploads
 * - Modal de arquivos + mudança de status/designado/complexidade
 * - Defensivo contra falhas da API (ex.: 500 em /api/acoes/arquivos/:id)
 */

/* ===================== Tenant helpers ===================== */
function getCookie(name) {
    const prefix = name + '=';
    const part = document.cookie.split('; ').find(row => row.startsWith(prefix));
    return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}


function getTenantHeaders() {
    const t = getCookie('tenant_id');
    return { 'x-tenant-id': t || '' };
}

/* ===================== Utils ===================== */
async function safeJson(resp) {
    try { return await resp.json(); } catch { return null; }
}
async function safeFetchJson(url, opts = {}) {
    try {
        const resp = await fetch(url, opts);
        if (!resp.ok) return { ok: false, data: await safeJson(resp) };
        return { ok: true, data: await safeJson(resp) };
    } catch {
        return { ok: false, data: null };
    }
}
function byId(id) { return document.getElementById(id); }
function ensureEl(id) { const el = byId(id); if (!el) throw new Error(`Elemento #${id} não encontrado`); return el; }
function formatComplexidade(c) {
    const v = String(c || '').toLowerCase();
    if (v === 'baixa' || v === 'baixo') return 'Baixa';
    if (v === 'media' || v === 'média' || v === 'medio' || v === 'médio') return 'Média';
    if (v === 'alta' || v === 'alto') return 'Alta';
    return c || 'Baixa';
}

/* ===================== Abas ===================== */
function mostrarAba(aba) {
    const elCriar = byId('aba-criar');
    const elAcomp = byId('aba-acompanhar');
    const elCorrig = byId('aba-corrigir');
    if (elCriar) elCriar.style.display = (aba === 'criar') ? 'block' : 'none';
    if (elAcomp) elAcomp.style.display = (aba === 'acompanhar') ? 'block' : 'none';
    if (elCorrig) elCorrig.style.display = (aba === 'corrigir') ? 'block' : 'none';

    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('ativo'));
    if (aba === 'criar') document.querySelectorAll('.aba-btn')[0]?.classList.add('ativo');
    if (aba === 'acompanhar') document.querySelectorAll('.aba-btn')[1]?.classList.add('ativo');
    if (aba === 'corrigir') document.querySelectorAll('.aba-btn')[2]?.classList.add('ativo');

    if (aba === 'acompanhar') carregarKanban();
    if (aba === 'corrigir') carregarKanbanCorrigir();
}

/* ===================== Kanban (acompanhar) ===================== */
async function carregarKanban() {
    const kanbanBoard = byId('kanbanBoard');
    if (!kanbanBoard) return;
    try {
        const { ok, data } = await safeFetchJson('/api/acoes', {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        });
        if (!ok || !data || typeof data !== 'object') {
            kanbanBoard.innerHTML = '<p style="text-align:center;color:#dc3545;">Erro ao carregar ações</p>';
            return;
        }

        const acoesPorDesignado = data;
        kanbanBoard.innerHTML = '';

        const designados = Object.keys(acoesPorDesignado).sort((a, b) => {
            if (a === 'Nenhum') return -1;
            if (b === 'Nenhum') return 1;
            return a.localeCompare(b, 'pt-BR');
        });

        let colunasRenderizadas = 0;
        designados.forEach(designado => {
            const acoes = acoesPorDesignado[designado] || [];
            const acoesFiltradas = acoes.filter(a => (a.status || '').toLowerCase() !== 'finalizado');
            if (!acoesFiltradas.length) return;
            const coluna = criarColunaKanban(designado, acoesFiltradas);
            kanbanBoard.appendChild(coluna);
            colunasRenderizadas++;
        });

        if (colunasRenderizadas === 0) {
            kanbanBoard.innerHTML = '<p style="text-align:center;color:#666;grid-column:1/-1;">Nenhuma ação encontrada</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar kanban:', error);
        kanbanBoard.innerHTML = '<p style="text-align:center;color:#dc3545;">Erro ao carregar ações</p>';
    }
}

function criarColunaKanban(designado, acoesFiltradas) {
    const coluna = document.createElement('div');
    coluna.className = 'kanban-column';

    const header = document.createElement('div');
    header.className = 'kanban-column-header';

    const title = document.createElement('div');
    title.className = 'kanban-column-title';
    title.textContent = designado;

    const count = document.createElement('div');
    count.className = 'kanban-column-count';
    count.textContent = acoesFiltradas.length;

    header.appendChild(title);
    header.appendChild(count);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards';
    acoesFiltradas.forEach(acao => cardsContainer.appendChild(criarCardAcao(acao)));

    coluna.appendChild(header);
    coluna.appendChild(cardsContainer);
    return coluna;
}

function criarCardAcao(acao) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.onclick = () => abrirDetalhesAcao(acao.id);

    const statusClass = (acao.status || '').replace(/\s+/g, '-').toLowerCase();
    const dataFormatada = acao?.data_criacao ? new Date(acao.data_criacao).toLocaleDateString('pt-BR') : '';

    card.innerHTML = `
    <div class="kanban-card-title">${acao.titulo || ''}</div>
    <div class="kanban-card-cliente">👤 ${acao.cliente || ''}</div>
    <div class="kanban-card-status status-${statusClass}">
      ${acao.status || ''} - Nível ${formatComplexidade(acao.complexidade)}
    </div>
    <div class="kanban-card-meta">
      <span class="kanban-card-criador">Por: ${acao.criador || ''}</span>
      <span class="kanban-card-data">${dataFormatada}</span>
    </div>
  `;
    return card;
}

/* ===================== Modal (acompanhar) ===================== */
async function abrirDetalhesAcao(acaoId) {
    try {
        const [arquivosResp, statusResp] = await Promise.all([
            safeFetchJson(`/api/acoes/arquivos/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
            safeFetchJson(`/api/acoes/status/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
        ]);

        // Se a API de arquivos falhar (ex.: 500 do backend), não travamos o modal.
        const arquivosPorTipo = (arquivosResp.ok && arquivosResp.data) ? arquivosResp.data : {};
        const dadosStatus = (statusResp.ok && statusResp.data) ? statusResp.data : { status: 'Não iniciado', complexidade: 'baixa' };

        if (!arquivosResp.ok) {
            console.warn('Falha ao obter arquivos da ação (abrirDetalhesAcao):', arquivosResp);
        }

        mostrarModalDocumentosAcompanhamento(
            acaoId,
            arquivosPorTipo,
            dadosStatus.status,
            false,
            dadosStatus.complexidade
        );
    } catch (e) {
        alert('Erro ao buscar dados da ação.');
    }
}

/* ===================== Kanban (corrigir) ===================== */
async function carregarKanbanCorrigir() {
    const kanbanBoard = byId('kanbanBoardCorrigir');
    if (!kanbanBoard) return;
    try {
        const { ok, data } = await safeFetchJson('/api/acoes?status=Finalizado', {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        });
        if (!ok || !data || typeof data !== 'object') {
            kanbanBoard.innerHTML = '<p style="text-align:center;color:#dc3545;">Erro ao carregar ações</p>';
            return;
        }

        const acoesPorDesignado = data;
        kanbanBoard.innerHTML = '';

        const designados = Object.keys(acoesPorDesignado).sort((a, b) => {
            if (a === 'Nenhum') return -1;
            if (b === 'Nenhum') return 1;
            return a.localeCompare(b, 'pt-BR');
        });

        let colunasRenderizadas = 0;

        designados.forEach(designado => {
            const acoes = acoesPorDesignado[designado] || [];
            const acoesFiltradas = acoes.filter(acao => !acao.data_aprovado);
            if (!acoesFiltradas.length) return;

            const coluna = criarColunaKanbanCorrigir(designado, acoesFiltradas);
            kanbanBoard.appendChild(coluna);
            colunasRenderizadas++;
        });

        if (colunasRenderizadas === 0) {
            kanbanBoard.innerHTML = '<p style="text-align:center;color:#666;grid-column:1/-1;">Nenhuma ação finalizada para corrigir</p>';
        }
    } catch {
        kanbanBoard.innerHTML = '<p style="text-align:center;color:#dc3545;">Erro ao carregar ações</p>';
    }
}

function criarColunaKanbanCorrigir(designado, acoesFiltradas) {
    const coluna = document.createElement('div');
    coluna.className = 'kanban-column';

    const header = document.createElement('div');
    header.className = 'kanban-column-header';

    const title = document.createElement('div');
    title.className = 'kanban-column-title';
    title.textContent = designado;

    const count = document.createElement('div');
    count.className = 'kanban-column-count';
    count.textContent = acoesFiltradas.length;

    header.appendChild(title);
    header.appendChild(count);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards';

    acoesFiltradas.forEach(acao => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.onclick = () => abrirDetalhesAcaoCorrigir(acao.id);

        const statusClass = (acao.status || '').replace(/\s+/g, '-').toLowerCase();
        const dataFormatada = acao?.data_criacao ? new Date(acao.data_criacao).toLocaleDateString('pt-BR') : '';

        card.innerHTML = `
      <div class="kanban-card-title">${acao.titulo || ''}</div>
      <div class="kanban-card-cliente">👤 ${acao.cliente || ''}</div>
      <div class="kanban-card-status status-${statusClass}">
        ${acao.status || ''} - Nível ${formatComplexidade(acao.complexidade)}
      </div>
      <div class="kanban-card-meta">
        <span class="kanban-card-criador">Por: ${acao.criador || ''}</span>
        <span class="kanban-card-data">${dataFormatada}</span>
      </div>
    `;
        cardsContainer.appendChild(card);
    });

    coluna.appendChild(header);
    coluna.appendChild(cardsContainer);
    return coluna;
}

async function abrirDetalhesAcaoCorrigir(acaoId) {
    try {
        const [arquivosResp, statusResp] = await Promise.all([
            safeFetchJson(`/api/acoes/arquivos/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
            safeFetchJson(`/api/acoes/status/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
        ]);

        const arquivosPorTipo = (arquivosResp.ok && arquivosResp.data) ? arquivosResp.data : {};
        const dadosStatus = (statusResp.ok && statusResp.data) ? statusResp.data : { status: 'Finalizado', complexidade: 'baixa' };

        if (!arquivosResp.ok) {
            console.warn('Falha ao obter arquivos da ação (abrirDetalhesAcaoCorrigir):', arquivosResp);
        }

        mostrarModalDocumentosAcompanhamento(
            acaoId,
            arquivosPorTipo,
            dadosStatus.status,
            true,
            dadosStatus.complexidade
        );
    } catch {
        alert('Erro ao buscar dados da ação.');
    }
}

/* ===================== Modal base (acompanhar/corrigir) ===================== */
function mostrarModalDocumentosAcompanhamento(acaoId, arquivosPorTipo, statusAtual, modoCorrigir, complexidadeAtual) {
    const modal = ensureEl('modalDocumentos');
    const lista = ensureEl('modalDocsLista');
    const modalContent = document.querySelector('.modal-docs-content');
    if (!modalContent) return;

    lista.innerHTML = '';

    // Header
    let headerRow = byId('modalDocsHeaderRow');
    if (headerRow) headerRow.remove();
    headerRow = document.createElement('div');
    headerRow.id = 'modalDocsHeaderRow';
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.width = '100%';
    headerRow.style.marginBottom = '1.2rem';
    headerRow.innerHTML = `
    <h3 style='margin:0;color:#4953b8;font-size:1.25rem;font-weight:600;'>Documentos da Ação</h3>
    <div style='display:flex;align-items:center;gap:1rem;flex-wrap:wrap;'>
      <span style="font-size:1.1rem;font-weight:600;color:#4953b8;">Designado:</span>
      <select id="modalDesignadoSelect" style="padding:0.4rem 1rem;border-radius:6px;font-size:1rem;min-width:120px;"></select>

      <span style="font-size:1.1rem;font-weight:600;color:#4953b8;">Complexidade:</span>
      <select id="modalComplexidadeSelect" style="padding:0.4rem 1rem;border-radius:6px;font-size:1rem;">
        <option value="baixa">Baixa</option>
        <option value="media">Média</option>
        <option value="alta">Alta</option>
      </select>

      <span style="font-size:1.1rem;font-weight:600;color:#4953b8;">Status:</span>
      <select id="modalStatusSelect" style="padding:0.4rem 1rem;border-radius:6px;font-size:1rem;">
        <option value="Não iniciado">Não iniciado</option>
        <option value="Em andamento">Em andamento</option>
        ${modoCorrigir ? '<option value="Devolvido">Devolvido</option>' : ''}
        <option value="Finalizado">Finalizado</option>
      </select>

      <button id="modalStatusSalvar" class="modal-docs-upload-btn" style="padding:0.4rem 1.2rem;">Salvar</button>
      ${modoCorrigir ? `<button id="modalAprovar" class="modal-docs-upload-btn" style="padding:0.4rem 1.2rem;background:#28a745;">Aprovar</button>` : ''}

      <span id="modalStatusMsg" style="margin-left:0.7rem;font-size:0.98rem;"></span>
    </div>
  `;
    modalContent.insertBefore(headerRow, modalContent.querySelector('#modalDocsLista'));

    // Comentário do revisor (somente acompanhar)
    let comentarioInfo = byId('modalComentarioInfo');
    if (comentarioInfo) comentarioInfo.remove();
    if (!modoCorrigir) {
        safeFetchJson(`/api/acoes/comentario/${acaoId}`, {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        }).then(({ ok, data }) => {
            if (ok && data?.comentario) {
                comentarioInfo = document.createElement('div');
                comentarioInfo.id = 'modalComentarioInfo';
                comentarioInfo.style.width = '100%';
                comentarioInfo.style.background = '#fffbe6';
                comentarioInfo.style.border = '1.5px solid #ffe066';
                comentarioInfo.style.borderRadius = '7px';
                comentarioInfo.style.padding = '1rem';
                comentarioInfo.style.marginBottom = '1rem';
                comentarioInfo.style.color = '#856404';
                comentarioInfo.style.fontWeight = '500';
                comentarioInfo.innerHTML = `<span style='font-size:1.08em;'>📝 <b>Comentário do revisor:</b><br>${data.comentario}</span>`;
                modalContent.insertBefore(comentarioInfo, modalContent.querySelector('#modalDocsLista'));
            }
        });
    }

    // Caixa de comentário (somente corrigir)
    let comentarioBox = byId('modalComentarioBox');
    if (comentarioBox) comentarioBox.remove();
    if (modoCorrigir) {
        comentarioBox = document.createElement('div');
        comentarioBox.id = 'modalComentarioBox';
        comentarioBox.style.width = '100%';
        comentarioBox.style.marginBottom = '1rem';
        comentarioBox.innerHTML = `
      <label for="modalComentario" style="font-weight:600;color:#4953b8;">Comentário para devolução:</label>
      <textarea id="modalComentario" rows="3" style="width:100%;border-radius:6px;border:1px solid #d1d5db;padding:0.7rem;font-size:1rem;margin-top:0.3rem;"></textarea>
      <small style="color:#888;">(Preencha ao devolver para o estagiário)</small>
    `;
        modalContent.insertBefore(comentarioBox, modalContent.querySelector('#modalDocsLista'));
    }

    // Preenche designados
    safeFetchJson('/api/usuarios/designados', { headers: { ...getTenantHeaders() }, credentials: 'same-origin' })
        .then(({ ok, data }) => {
            const select = byId('modalDesignadoSelect');
            if (!select) return;
            select.innerHTML = '<option value="Nenhum">Nenhum</option>';
            if (ok && Array.isArray(data)) {
                data.forEach(e => {
                    const opt = document.createElement('option');
                    opt.value = e.nome; // updateStatus espera NOME no backend
                    opt.textContent = e.nome;
                    select.appendChild(opt);
                });
            }
            select.value = window.__modalDesignadoAtual || 'Nenhum';
        });

    // Preenche status/complexidade atuais
    setTimeout(() => {
        const selStatus = byId('modalStatusSelect');
        if (selStatus) selStatus.value = statusAtual || 'Não iniciado';
        const selComp = byId('modalComplexidadeSelect');
        if (selComp) selComp.value = (String(complexidadeAtual || 'baixa')).toLowerCase();
    }, 50);

    // Salvar (status/designado/complexidade + uploads)
    const salvarBtn = byId('modalStatusSalvar');
    if (salvarBtn) {
        salvarBtn.onclick = async () => {
            const novoStatus = byId('modalStatusSelect')?.value || 'Não iniciado';
            const novoDesignado = byId('modalDesignadoSelect')?.value || 'Nenhum';
            const novaComplexidade = byId('modalComplexidadeSelect')?.value || 'baixa';
            const msg = byId('modalStatusMsg');
            if (msg) msg.textContent = 'Salvando...';

            // Em modo corrigir: se tirar de Finalizado, exige comentário
            if (modoCorrigir && statusAtual === 'Finalizado' && novoStatus !== 'Finalizado') {
                const comentario = (byId('modalComentario')?.value || '').trim();
                if (!comentario) {
                    if (msg) msg.textContent = 'Por favor, escreva um comentário para devolução.';
                    return;
                }
                const rComent = await safeFetchJson(`/api/acoes/comentario/${acaoId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
                    credentials: 'same-origin',
                    body: JSON.stringify({ comentario }),
                });
                if (!rComent.ok) {
                    if (msg) msg.textContent = 'Erro ao salvar comentário.';
                    return;
                }
            }

            // Salva status/designado/complexidade
            const rStatus = await safeFetchJson(`/api/acoes/status/${acaoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
                credentials: 'same-origin',
                body: JSON.stringify({ status: novoStatus, designado: novoDesignado, complexidade: novaComplexidade }),
            });

            // Uploads (somente se preenchidos)
            const tiposUpload = [
                { campo: 'modalContratoUpload', rota: '/api/acoes/upload-contrato' },
                { campo: 'modalProcuracaoUpload', rota: '/api/acoes/upload-procuracao' },
                { campo: 'modalDeclaracaoUpload', rota: '/api/acoes/upload-declaracao' },
                { campo: 'modalFichaUpload', rota: '/api/acoes/upload-ficha' },
                { campo: 'modalDocumentacaoUpload', rota: '/api/acoes/upload-documentacao' },
                { campo: 'modalProvasUpload', rota: '/api/acoes/upload-provas' },
                { campo: 'modalAcaoUpload', rota: '/api/acoes/upload-acao' },
            ];

            let uploadsOK = true;
            for (const tipo of tiposUpload) {
                const input = byId(tipo.campo);
                if (input && input.files && input.files.length) {
                    const formData = new FormData();
                    formData.append('acao_id', acaoId);
                    formData.append('arquivo', input.files[0]);
                    const rArq = await safeFetchJson(tipo.rota, {
                        method: 'POST',
                        headers: { ...getTenantHeaders() },
                        credentials: 'same-origin',
                        body: formData,
                    });
                    uploadsOK = uploadsOK && rArq.ok;
                }
            }

            if (rStatus.ok && uploadsOK) {
                if (msg) msg.textContent = 'Salvo!';
                const modalEl = byId('modalDocumentos');
                if (modalEl) modalEl.style.display = 'none';
                setTimeout(() => { if (msg) msg.textContent = ''; }, 1200);
                if (modoCorrigir) carregarKanbanCorrigir(); else carregarKanban();
            } else {
                if (msg) msg.textContent = 'Erro ao salvar';
            }
        };
    }

    if (modoCorrigir) {
        const aprovarBtn = byId('modalAprovar');
        if (aprovarBtn) {
            aprovarBtn.onclick = async () => {
                const msg = byId('modalStatusMsg');
                if (msg) msg.textContent = 'Aprovando...';
                const r = await safeFetchJson(`/api/acoes/aprovar/${acaoId}`, {
                    method: 'POST',
                    headers: { ...getTenantHeaders() },
                    credentials: 'same-origin',
                });
                if (r.ok) {
                    if (msg) msg.textContent = 'Aprovado!';
                    const modalEl = byId('modalDocumentos');
                    if (modalEl) modalEl.style.display = 'none';
                    setTimeout(() => { if (msg) msg.textContent = ''; }, 1200);
                    carregarKanbanCorrigir();
                } else {
                    if (msg) msg.textContent = 'Erro ao aprovar';
                }
            };
        }
    }

    // Designado atual (para fill do select ao abrir)
    window.__modalDesignadoAtual = arquivosPorTipo?.__designadoAtual || 'Nenhum';

    // Monta blocos por tipo
    const tipos = {
        'Contrato': arquivosPorTipo?.Contrato || [],
        'Procuracao': arquivosPorTipo?.Procuracao || [],
        'Declaracao': arquivosPorTipo?.Declaracao || [],
        'Ficha': arquivosPorTipo?.Ficha || [],
        'Documentação': arquivosPorTipo?.Documentacao || [],
        'Provas': arquivosPorTipo?.Provas || [],
        'Ação': arquivosPorTipo?.Acao || [],
    };

    const blocos = document.createElement('div');
    blocos.className = 'modal-docs-tipos';

    Object.entries(tipos).forEach(([titulo, listaArqs]) => {
        const bloco = document.createElement('div');
        bloco.className = 'modal-docs-bloco';
        bloco.innerHTML = `<div class='modal-docs-bloco-titulo'>${titulo}</div>`;

        // Upload inline quando não há arquivo
        if (!Array.isArray(listaArqs)) listaArqs = [];
        if (listaArqs.length === 0) {
            const tipoCampo =
                titulo === 'Contrato' ? 'modalContratoUpload' :
                    titulo === 'Procuracao' ? 'modalProcuracaoUpload' :
                        titulo === 'Declaracao' ? 'modalDeclaracaoUpload' :
                            titulo === 'Ficha' ? 'modalFichaUpload' :
                                titulo === 'Documentação' ? 'modalDocumentacaoUpload' :
                                    titulo === 'Provas' ? 'modalProvasUpload' :
                                        titulo === 'Ação' ? 'modalAcaoUpload' : '';

            const uploadDrop = document.createElement('div');
            uploadDrop.className = 'modal-docs-upload-drop';
            uploadDrop.innerHTML = `
        <span class="icon">📎</span>
        <span id="${tipoCampo}Label">Arraste o arquivo aqui ou clique para selecionar</span>
        <span class="file-name" id="${tipoCampo}Nome"></span>
        <input type='file' id='${tipoCampo}' accept='.pdf,.doc,.docx,.png,.jpg,.jpeg' style='display:none;'>
      `;
            bloco.appendChild(uploadDrop);

            const input = uploadDrop.querySelector(`#${tipoCampo}`);
            const nomeSpan = uploadDrop.querySelector(`#${tipoCampo}Nome`);
            uploadDrop.onclick = () => input?.click();
            input?.addEventListener('change', () => {
                if (nomeSpan) nomeSpan.textContent = input.files.length ? input.files[0].name : '';
            });
            uploadDrop.addEventListener('dragover', e => { e.preventDefault(); uploadDrop.classList.add('dragover'); });
            uploadDrop.addEventListener('dragleave', () => uploadDrop.classList.remove('dragover'));
            uploadDrop.addEventListener('drop', e => {
                e.preventDefault();
                uploadDrop.classList.remove('dragover');
                if (e.dataTransfer.files?.length) {
                    if (input) {
                        input.files = e.dataTransfer.files;
                        if (nomeSpan) nomeSpan.textContent = input.files[0].name;
                    }
                }
            });
        }

        // Lista de arquivos já existentes
        const arqsDiv = document.createElement('div');
        arqsDiv.className = 'modal-docs-arquivos';
        if (listaArqs.length === 0) {
            arqsDiv.innerHTML = `<div style='color:#888'>Nenhum arquivo.</div>`;
        } else {
            listaArqs.forEach(arq => {
                const card = document.createElement('div');
                card.className = 'modal-docs-arquivo-card';
                const nomeBase = String(arq?.nome || '').replace(/^(CON|DEC|PRO|FIC|DOC|PROV|ACAO)\s*-\s*/, '');
                const nomeCurto = nomeBase.length > 18 ? nomeBase.slice(0, 18) + '…' : nomeBase;
                const linkPath = (arq?.path || '').replace(/^.*public/, '') || '#';

                card.innerHTML = `
          <span class="modal-docs-arquivo-icon">📄</span>
          <span class="modal-docs-arquivo-nome" title="${arq?.nome || ''}">${nomeCurto}</span>
          <a class="modal-docs-arquivo-link" href="${linkPath}" target="_blank" title="Baixar ${arq?.nome || ''}">⬇️</a>
          <button class="modal-docs-arquivo-remove" title="Excluir" style="margin-left:0.7rem;color:#e53e3e;background:none;border:none;font-size:1.2em;cursor:pointer;font-weight:bold;">×</button>
        `;

                card.querySelector('.modal-docs-arquivo-remove')?.addEventListener('click', async (ev) => {
                    ev.stopPropagation();
                    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
                    const r = await safeFetchJson('/api/acoes/remover-arquivo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
                        credentials: 'same-origin',
                        body: JSON.stringify({ acaoId, nomeArquivo: arq?.nome }),
                    });
                    if (r.ok) {
                        if (modoCorrigir) abrirDetalhesAcaoCorrigir(acaoId);
                        else abrirDetalhesAcao(acaoId);
                    } else {
                        alert('Erro ao excluir arquivo.');
                    }
                });

                arqsDiv.appendChild(card);
            });
        }

        bloco.appendChild(arqsDiv);
        blocos.appendChild(bloco);
    });

    lista.appendChild(blocos);

    // Aviso se arquivos vieram vazios por erro no backend
    if (!arquivosPorTipo || Object.keys(arquivosPorTipo).length === 0) {
        const warn = document.createElement('div');
        warn.style.marginTop = '8px';
        warn.style.color = '#b7791f';
        warn.style.fontSize = '.95rem';
        warn.textContent = 'Não foi possível listar arquivos agora. Você ainda pode alterar status/designado/complexidade e enviar novos arquivos.';
        lista.appendChild(warn);
    }

    modal.style.display = 'flex';
}

function fecharModalDocumentos() {
    const modal = byId('modalDocumentos');
    if (modal) modal.style.display = 'none';
}

/* ===================== Formulário de criação ===================== */
async function carregarOpcoes() {
    // Clientes
    const rCli = await safeFetchJson('/api/clientes', { headers: { ...getTenantHeaders() }, credentials: 'same-origin' });
    const clientes = Array.isArray(rCli.data) ? rCli.data : [];
    const selectCliente = byId('cliente');
    if (selectCliente) {
        clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.nome} - ${c.cpf_cnpj}`;
            selectCliente.appendChild(opt);
        });
    }

    // Designados
    const rDes = await safeFetchJson('/api/usuarios/designados', { headers: { ...getTenantHeaders() }, credentials: 'same-origin' });
    const designados = Array.isArray(rDes.data) ? rDes.data : [];
    const selectdesignado = byId('designado');
    if (selectdesignado) {
        designados.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id; // criação usa id; backend resolve nome/id
            opt.textContent = e.nome;
            selectdesignado.appendChild(opt);
        });
    }
}

// somar listeners apenas quando os elementos existem
document.addEventListener('DOMContentLoaded', () => {
    carregarOpcoes();

    const form = byId('formAcao');
    const mensagem = byId('mensagem');

    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (mensagem) mensagem.textContent = '';

            const formData = new FormData();
            formData.append('cliente_id', byId('cliente')?.value || '');
            formData.append('designado_id', byId('designado')?.value || '');
            formData.append('status', 'Não iniciado');
            formData.append('complexidade', byId('complexidade')?.value || 'baixa');
            formData.append('titulo', byId('titulo')?.value || '');

            // arquivos
            ['contratoArquivo', 'procuracaoArquivo', 'declaracaoArquivo', 'fichaArquivo', 'documentacaoArquivo', 'provasArquivo']
                .forEach(campo => {
                    const input = byId(campo);
                    if (input?.files?.length) {
                        Array.from(input.files).forEach(f => formData.append(campo, f));
                    }
                });

            const r = await safeFetchJson('/api/acoes', {
                method: 'POST',
                headers: { ...getTenantHeaders() },
                credentials: 'same-origin',
                body: formData,
            });

            if (r.ok) {
                this.reset();
                ['contratoArquivoLista', 'procuracaoArquivoLista', 'declaracaoArquivoLista', 'fichaArquivoLista', 'documentacaoArquivoLista', 'provasArquivoLista']
                    .forEach(id => { const el = byId(id); if (el) el.innerHTML = ''; });
                mostrarPopupAcaoCriada((r.data && r.data.mensagem) || 'Ação criada com sucesso!');
            } else {
                if (mensagem) {
                    mensagem.textContent = (r.data && r.data.mensagem) || 'Erro ao criar ação';
                    mensagem.style.color = '#dc3545';
                }
            }
        });
    }

    // Uploads: listas e DnD
    function atualizarListaArquivos(inputId, listaId) {
        const input = byId(inputId);
        const lista = byId(listaId);
        if (!input || !lista) return;
        lista.innerHTML = '';
        if (input.files?.length) {
            Array.from(input.files).forEach((file, idx) => {
                const item = document.createElement('div');
                item.className = 'file-list-item';
                item.innerHTML = `<span>${file.name}</span><button type="button" class="remove-file" title="Remover" data-idx="${idx}">×</button>`;
                lista.appendChild(item);
            });
            lista.querySelectorAll('.remove-file').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    removerArquivo(inputId, parseInt(btn.getAttribute('data-idx'), 10));
                };
            });
        }
    }
    function removerArquivo(inputId, idx) {
        const input = byId(inputId);
        if (!input || !input.files) return;
        const dt = new DataTransfer();
        Array.from(input.files).forEach((file, i) => { if (i !== idx) dt.items.add(file); });
        input.files = dt.files;
        atualizarListaArquivos(inputId, inputId + 'Lista');
    }

    ['contratoArquivo', 'procuracaoArquivo', 'declaracaoArquivo', 'fichaArquivo', 'documentacaoArquivo', 'provasArquivo'].forEach(id => {
        const el = byId(id);
        if (el) el.addEventListener('change', () => atualizarListaArquivos(id, id + 'Lista'));
    });

    function setupDrop(dropId, inputId) {
        const drop = byId(dropId);
        const input = byId(inputId);
        if (!drop || !input) return;
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
        drop.addEventListener('drop', (e) => {
            e.preventDefault();
            drop.classList.remove('dragover');
            if (e.dataTransfer.files?.length) {
                const dt = new DataTransfer();
                Array.from(input.files || []).forEach(f => dt.items.add(f));
                Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
                input.files = dt.files;
                atualizarListaArquivos(inputId, inputId + 'Lista');
            }
        });
    }
    setupDrop('drop-contrato', 'contratoArquivo');
    setupDrop('drop-procuracao', 'procuracaoArquivo');
    setupDrop('drop-declaracao', 'declaracaoArquivo');
    setupDrop('drop-ficha', 'fichaArquivo');
    setupDrop('drop-documentacao', 'documentacaoArquivo');
    setupDrop('drop-provas', 'provasArquivo');
});

/* ===================== Toast ===================== */
function mostrarPopupAcaoCriada(msg) {
    let container = byId('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.bottom = '24px';
        container.style.left = '24px';
        container.style.zIndex = '3000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-acao-criada';
    toast.style.background = '#fff';
    toast.style.borderLeft = '6px solid #28a745';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 4px 16px rgba(40,167,69,0.13)';
    toast.style.padding = '1.1rem 1.7rem 1.1rem 1.2rem';
    toast.style.minWidth = '220px';
    toast.style.maxWidth = '340px';
    toast.style.fontSize = '1.08rem';
    toast.style.color = '#222';
    toast.style.fontWeight = '500';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.7rem';
    toast.innerHTML = `<span style='font-size:1.6rem;color:#28a745;'>✅</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.4s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 2200);
}
