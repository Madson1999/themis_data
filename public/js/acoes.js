/**
 * public/js/acoes.js
 * ----------------------------------------
 * Frontend de Ações (Kanban) — SaaS multi-tenant.
 *
 * - Envia sempre o cabeçalho `x-tenant-id` (lido do cookie `tenant_id`)
 * - Carrega Kanban (acompanhar / corrigir)
 * - Criação de ação com múltiplos uploads
 * - Modal de arquivos + mudança de status/designado/complexidade
 * - Máscaras e UX de uploads
 */

/* ===================== Tenant helpers ===================== */
function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
}
function getTenantHeaders() {
    const t = getCookie('tenant_id');
    return { 'x-tenant-id': t || '' };
}

/* ===================== Abas ===================== */
function mostrarAba(aba) {
    document.getElementById('aba-criar').style.display = aba === 'criar' ? 'block' : 'none';
    document.getElementById('aba-acompanhar').style.display = aba === 'acompanhar' ? 'block' : 'none';
    document.getElementById('aba-corrigir').style.display = aba === 'corrigir' ? 'block' : 'none';

    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('ativo'));
    if (aba === 'criar') document.querySelectorAll('.aba-btn')[0].classList.add('ativo');
    if (aba === 'acompanhar') document.querySelectorAll('.aba-btn')[1].classList.add('ativo');
    if (aba === 'corrigir') document.querySelectorAll('.aba-btn')[2].classList.add('ativo');

    if (aba === 'acompanhar') carregarKanban();
    if (aba === 'corrigir') carregarKanbanCorrigir();
}

/* ===================== Kanban (acompanhar) ===================== */
async function carregarKanban() {
    try {
        const response = await fetch('/api/acoes', {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        });
        const acoesPorDesignado = await response.json();

        const kanbanBoard = document.getElementById('kanbanBoard');
        kanbanBoard.innerHTML = '';

        const designados = Object.keys(acoesPorDesignado).sort((a, b) => {
            if (a === 'Nenhum') return -1;
            if (b === 'Nenhum') return 1;
            return a.localeCompare(b, 'pt-BR');
        });

        let colunasRenderizadas = 0;

        designados.forEach(designado => {
            const acoes = acoesPorDesignado[designado] || [];
            const acoesFiltradas = acoes.filter(a => (a.status || '').toLowerCase() !== 'finalizado'); // ignora finalizados
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
        document.getElementById('kanbanBoard').innerHTML =
            '<p style="text-align:center;color:#dc3545;">Erro ao carregar ações</p>';
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

function formatComplexidade(c) {
    const v = String(c || '').toLowerCase();
    if (v === 'baixa' || v === 'baixo') return 'Baixa';
    if (v === 'media' || v === 'média' || v === 'medio' || v === 'médio') return 'Média';
    if (v === 'alta' || v === 'alto') return 'Alta';
    // já pode vir capitalizada do backend
    return c || 'Baixa';
}

function criarCardAcao(acao) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.onclick = () => abrirDetalhesAcao(acao.id);

    const statusClass = (acao.status || '').replace(/\s+/g, '-').toLowerCase();
    const dataFormatada = new Date(acao.data_criacao).toLocaleDateString('pt-BR');

    card.innerHTML = `
    <div class="kanban-card-title">${acao.titulo}</div>
    <div class="kanban-card-cliente">👤 ${acao.cliente}</div>
    <div class="kanban-card-status status-${statusClass}">
      ${acao.status} - Nível ${formatComplexidade(acao.complexidade)}
    </div>
    <div class="kanban-card-meta">
      <span class="kanban-card-criador">Por: ${acao.criador}</span>
      <span class="kanban-card-data">${dataFormatada}</span>
    </div>
  `;
    return card;
}

/* ===================== Modal (acompanhar) ===================== */
async function abrirDetalhesAcao(acaoId) {
    try {
        const [respArq, respStatus] = await Promise.all([
            fetch(`/api/acoes/arquivos/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
            fetch(`/api/acoes/status/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
        ]);
        const arquivosPorTipo = await respArq.json();
        const dadosStatus = await respStatus.json();
        mostrarModalDocumentosAcompanhamento(
            acaoId,
            arquivosPorTipo,
            dadosStatus.status,
            false,
            dadosStatus.complexidade
        );
    } catch (_e) {
        alert('Erro ao buscar arquivos ou status da ação.');
    }
}

/* ===================== Kanban (corrigir) ===================== */
async function carregarKanbanCorrigir() {
    try {
        // Usa status com capitalização exata para coincidir com o backend
        const response = await fetch('/api/acoes?status=Finalizado', {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        });
        const acoesPorDesignado = await response.json();

        const kanbanBoard = document.getElementById('kanbanBoardCorrigir');
        kanbanBoard.innerHTML = '';

        const designados = Object.keys(acoesPorDesignado).sort((a, b) => {
            if (a === 'Nenhum') return -1;
            if (b === 'Nenhum') return 1;
            return a.localeCompare(b, 'pt-BR');
        });

        let colunasRenderizadas = 0;

        designados.forEach(designado => {
            const acoes = acoesPorDesignado[designado] || [];
            const acoesFiltradas = acoes.filter(acao => !acao.data_aprovado); // ignora já aprovadas
            if (!acoesFiltradas.length) return;

            const coluna = criarColunaKanbanCorrigir(designado, acoesFiltradas);
            kanbanBoard.appendChild(coluna);
            colunasRenderizadas++;
        });

        if (colunasRenderizadas === 0) {
            kanbanBoard.innerHTML =
                '<p style="text-align:center;color:#666;grid-column:1/-1;">Nenhuma ação finalizada para corrigir</p>';
        }
    } catch (_e) {
        document.getElementById('kanbanBoardCorrigir').innerHTML =
            '<p style="text-align:center;color:#dc3545;">Erro ao carregar ações</p>';
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
        const dataFormatada = new Date(acao.data_criacao).toLocaleDateString('pt-BR');

        card.innerHTML = `
      <div class="kanban-card-title">${acao.titulo}</div>
      <div class="kanban-card-cliente">👤 ${acao.cliente}</div>
      <div class="kanban-card-status status-${statusClass}">
        ${acao.status} - Nível ${formatComplexidade(acao.complexidade)}
      </div>
      <div class="kanban-card-meta">
        <span class="kanban-card-criador">Por: ${acao.criador}</span>
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
        const [respArq, respStatus] = await Promise.all([
            fetch(`/api/acoes/arquivos/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
            fetch(`/api/acoes/status/${acaoId}`, { headers: { ...getTenantHeaders() }, credentials: 'same-origin' }),
        ]);
        const arquivosPorTipo = await respArq.json();
        const dadosStatus = await respStatus.json();
        mostrarModalDocumentosAcompanhamento(
            acaoId,
            arquivosPorTipo,
            dadosStatus.status,
            true,
            dadosStatus.complexidade
        );
    } catch (_e) {
        alert('Erro ao buscar arquivos ou status da ação.');
    }
}

/* ===================== Modal base (acompanhar/corrigir) ===================== */
function mostrarModalDocumentosAcompanhamento(acaoId, arquivosPorTipo, statusAtual, modoCorrigir, complexidadeAtual) {
    const modal = document.getElementById('modalDocumentos');
    const lista = document.getElementById('modalDocsLista');
    lista.innerHTML = '';

    const modalContent = document.querySelector('.modal-docs-content');
    let headerRow = document.getElementById('modalDocsHeaderRow');
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
    <div style='display:flex;align-items:center;gap:1rem;'>
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
    let comentarioInfo = document.getElementById('modalComentarioInfo');
    if (comentarioInfo) comentarioInfo.remove();
    if (!modoCorrigir) {
        fetch(`/api/acoes/comentario/${acaoId}`, {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        })
            .then(r => r.json())
            .then(data => {
                if (data.comentario) {
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

    // Caixa de comentário (somente corrigir, quando devolvendo)
    let comentarioBox = document.getElementById('modalComentarioBox');
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

    // Preenche designados (nomes — updateStatus espera o nome no backend)
    fetch('/api/usuarios/designados', { headers: { ...getTenantHeaders() }, credentials: 'same-origin' })
        .then(r => r.json())
        .then(designados => {
            const select = document.getElementById('modalDesignadoSelect');
            select.innerHTML = '<option value="Nenhum">Nenhum</option>';
            designados.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.nome;
                opt.textContent = e.nome;
                select.appendChild(opt);
            });
            select.value = window.__modalDesignadoAtual || 'Nenhum';
        });

    setTimeout(() => {
        document.getElementById('modalStatusSelect').value = statusAtual || 'Não iniciado';
        const selComp = document.getElementById('modalComplexidadeSelect');
        if (selComp) selComp.value = (String(complexidadeAtual || 'baixa')).toLowerCase();
    }, 50);

    // Salvar (status/designado/complexidade + uploads)
    document.getElementById('modalStatusSalvar').onclick = async () => {
        const novoStatus = document.getElementById('modalStatusSelect').value;
        const novoDesignado = document.getElementById('modalDesignadoSelect').value;
        const novaComplexidade = document.getElementById('modalComplexidadeSelect').value;
        const msg = document.getElementById('modalStatusMsg');
        msg.textContent = 'Salvando...';

        // se estiver em correção e tirando de Finalizado → exige comentário
        if (modoCorrigir && statusAtual === 'Finalizado' && novoStatus !== 'Finalizado') {
            const comentario = (document.getElementById('modalComentario')?.value || '').trim();
            if (!comentario) {
                msg.textContent = 'Por favor, escreva um comentário para devolução.';
                return;
            }
            const respComentario = await fetch(`/api/acoes/comentario/${acaoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
                credentials: 'same-origin',
                body: JSON.stringify({ comentario }),
            });
            if (!respComentario.ok) {
                msg.textContent = 'Erro ao salvar comentário.';
                return;
            }
        }

        // Salva status/designado/complexidade
        const resp = await fetch(`/api/acoes/status/${acaoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
            credentials: 'same-origin',
            body: JSON.stringify({ status: novoStatus, designado: novoDesignado, complexidade: novaComplexidade }),
        });
        const statusOk = resp.ok;

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
        let arquivoOk = true;
        for (const tipo of tiposUpload) {
            const input = document.getElementById(tipo.campo);
            if (input && input.files && input.files.length) {
                const formData = new FormData();
                formData.append('acao_id', acaoId);
                formData.append('arquivo', input.files[0]);
                const respArq = await fetch(tipo.rota, {
                    method: 'POST',
                    headers: { ...getTenantHeaders() },
                    credentials: 'same-origin',
                    body: formData,
                });
                arquivoOk = arquivoOk && respArq.ok;
            }
        }

        if (statusOk && arquivoOk) {
            msg.textContent = 'Salvo!';
            document.getElementById('modalDocumentos').style.display = 'none';
            setTimeout(() => { msg.textContent = ''; }, 1200);
            if (modoCorrigir) carregarKanbanCorrigir(); else carregarKanban();
        } else {
            msg.textContent = 'Erro ao salvar';
        }
    };

    if (modoCorrigir) {
        document.getElementById('modalAprovar').onclick = async () => {
            const msg = document.getElementById('modalStatusMsg');
            msg.textContent = 'Aprovando...';
            const resp = await fetch(`/api/acoes/aprovar/${acaoId}`, {
                method: 'POST',
                headers: { ...getTenantHeaders() },
                credentials: 'same-origin',
            });
            if (resp.ok) {
                msg.textContent = 'Aprovado!';
                document.getElementById('modalDocumentos').style.display = 'none';
                setTimeout(() => { msg.textContent = ''; }, 1200);
                carregarKanbanCorrigir();
            } else {
                msg.textContent = 'Erro ao aprovar';
            }
        };
    }

    // Designado atual (para preencher select ao abrir)
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
            uploadDrop.onclick = () => input.click();
            input.addEventListener('change', () => {
                nomeSpan.textContent = input.files.length ? input.files[0].name : '';
            });
            uploadDrop.addEventListener('dragover', e => { e.preventDefault(); uploadDrop.classList.add('dragover'); });
            uploadDrop.addEventListener('dragleave', () => uploadDrop.classList.remove('dragover'));
            uploadDrop.addEventListener('drop', e => {
                e.preventDefault();
                uploadDrop.classList.remove('dragover');
                if (e.dataTransfer.files?.length) {
                    input.files = e.dataTransfer.files;
                    nomeSpan.textContent = input.files[0].name;
                }
            });
        }

        // Lista de arquivos já existentes
        const arqsDiv = document.createElement('div');
        arqsDiv.className = 'modal-docs-arquivos';
        if (!listaArqs.length) {
            arqsDiv.innerHTML = `<div style='color:#888'>Nenhum arquivo.</div>`;
        } else {
            listaArqs.forEach(arq => {
                const card = document.createElement('div');
                card.className = 'modal-docs-arquivo-card';
                const nomeBase = String(arq.nome || '').replace(/^(CON|DEC|PRO|FIC|DOC|PROV|ACAO)\s*-\s*/, '');
                const nomeCurto = nomeBase.length > 18 ? nomeBase.slice(0, 18) + '…' : nomeBase;

                card.innerHTML = `
          <span class="modal-docs-arquivo-icon">📄</span>
          <span class="modal-docs-arquivo-nome" title="${arq.nome}">${nomeCurto}</span>
          <a class="modal-docs-arquivo-link" href="${(arq.path || '').replace(/^.*public/, '')}" target="_blank" title="Baixar ${arq.nome}">⬇️</a>
          <button class="modal-docs-arquivo-remove" title="Excluir" style="margin-left:0.7rem;color:#e53e3e;background:none;border:none;font-size:1.2em;cursor:pointer;font-weight:bold;">×</button>
        `;

                card.querySelector('.modal-docs-arquivo-remove').onclick = async (ev) => {
                    ev.stopPropagation();
                    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
                    const resp = await fetch('/api/acoes/remover-arquivo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
                        credentials: 'same-origin',
                        body: JSON.stringify({ acaoId, nomeArquivo: arq.nome }),
                    });
                    if (resp.ok) {
                        if (modoCorrigir) abrirDetalhesAcaoCorrigir(acaoId);
                        else abrirDetalhesAcao(acaoId);
                    }
                };

                arqsDiv.appendChild(card);
            });
        }

        bloco.appendChild(arqsDiv);
        blocos.appendChild(bloco);
    });

    lista.appendChild(blocos);
    modal.style.display = 'flex';
}

function fecharModalDocumentos() {
    document.getElementById('modalDocumentos').style.display = 'none';
}

/* ===================== Formulário de criação ===================== */
async function carregarOpcoes() {
    // Clientes
    const clientes = await fetch('/api/clientes', { headers: { ...getTenantHeaders() }, credentials: 'same-origin' })
        .then(r => r.json()).catch(() => []);
    const selectCliente = document.getElementById('cliente');
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.nome} - ${c.cpf_cnpj}`;
        selectCliente.appendChild(opt);
    });

    // Designados
    const designados = await fetch('/api/usuarios/designados', { headers: { ...getTenantHeaders() }, credentials: 'same-origin' })
        .then(r => r.json()).catch(() => []);
    const selectdesignado = document.getElementById('designado');
    designados.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id; // criação usa id; backend resolve nome/id
        opt.textContent = e.nome;
        selectdesignado.appendChild(opt);
    });
}
carregarOpcoes();

document.getElementById('formAcao').addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData();

    formData.append('cliente_id', document.getElementById('cliente').value);
    formData.append('designado_id', document.getElementById('designado').value);
    formData.append('status', 'Não iniciado');
    formData.append('complexidade', document.getElementById('complexidade').value);
    formData.append('titulo', document.getElementById('titulo').value);

    // arquivos
    ['contratoArquivo', 'procuracaoArquivo', 'declaracaoArquivo', 'fichaArquivo', 'documentacaoArquivo', 'provasArquivo']
        .forEach(campo => {
            const files = document.getElementById(campo).files;
            for (let i = 0; i < files.length; i++) formData.append(campo, files[i]);
        });

    const resp = await fetch('/api/acoes', {
        method: 'POST',
        headers: { ...getTenantHeaders() },
        credentials: 'same-origin',
        body: formData,
    });
    const data = await resp.json();

    if (resp.ok) {
        this.reset();
        ['contratoArquivoLista', 'procuracaoArquivoLista', 'declaracaoArquivoLista', 'fichaArquivoLista', 'documentacaoArquivoLista', 'provasArquivoLista']
            .forEach(id => (document.getElementById(id).innerHTML = ''));
        mostrarPopupAcaoCriada(data.mensagem || 'Ação criada com sucesso!');
    } else {
        const mensagem = document.getElementById('mensagem');
        mensagem.textContent = data.mensagem || 'Erro ao criar ação';
        mensagem.style.color = '#dc3545';
    }
});

// limpa mensagem ao submeter
const form = document.getElementById('formAcao');
const mensagem = document.getElementById('mensagem');
form.addEventListener('submit', function () { mensagem.textContent = ''; });

/* ===================== Uploads: listas e DnD ===================== */
function atualizarListaArquivos(inputId, listaId) {
    const input = document.getElementById(inputId);
    const lista = document.getElementById(listaId);
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
    const input = document.getElementById(inputId);
    const dt = new DataTransfer();
    Array.from(input.files).forEach((file, i) => { if (i !== idx) dt.items.add(file); });
    input.files = dt.files;
    atualizarListaArquivos(inputId, inputId + 'Lista');
}

['contratoArquivo', 'procuracaoArquivo', 'declaracaoArquivo', 'fichaArquivo', 'documentacaoArquivo', 'provasArquivo'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => atualizarListaArquivos(id, id + 'Lista'));
});

function setupDrop(dropId, inputId) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('dragover');
        if (e.dataTransfer.files?.length) {
            const dt = new DataTransfer();
            Array.from(input.files).forEach(f => dt.items.add(f));
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

/* ===================== Toast ===================== */
function mostrarPopupAcaoCriada(msg) {
    let container = document.getElementById('toastContainer');
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
