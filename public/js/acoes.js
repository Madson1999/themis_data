// Alterna entre as abas
function mostrarAba(aba) {
    document.getElementById('aba-criar').style.display = aba === 'criar' ? 'block' : 'none';
    document.getElementById('aba-acompanhar').style.display = aba === 'acompanhar' ? 'block' : 'none';
    document.getElementById('aba-corrigir').style.display = aba === 'corrigir' ? 'block' : 'none';
    // Opcional: destaque visual no botão ativo
    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('ativo'));
    if (aba === 'criar') document.querySelectorAll('.aba-btn')[0].classList.add('ativo');
    if (aba === 'acompanhar') document.querySelectorAll('.aba-btn')[1].classList.add('ativo');
    if (aba === 'corrigir') document.querySelectorAll('.aba-btn')[2].classList.add('ativo');
    // Carregar kanban quando a aba for aberta
    if (aba === 'acompanhar') {
        carregarKanban();
    }
    if (aba === 'corrigir') {
        carregarKanbanCorrigir();
    }
}

// Função para carregar o kanban
async function carregarKanban() {
    try {
        const response = await fetch('/api/acoes');
        const acoesPorDesignado = await response.json();

        const kanbanBoard = document.getElementById('kanbanBoard');
        kanbanBoard.innerHTML = '';

        // Ordenar: 'Nenhum' primeiro, depois os demais em ordem alfabética
        const designados = Object.keys(acoesPorDesignado);
        designados.sort((a, b) => {
            if (a === 'Nenhum') return -1;
            if (b === 'Nenhum') return 1;
            return a.localeCompare(b, 'pt-BR');
        });
        designados.forEach(designado => {
            const acoes = acoesPorDesignado[designado];
            const coluna = criarColunaKanban(designado, acoes);
            kanbanBoard.appendChild(coluna);
        });

        // Se não houver ações, mostrar mensagem
        if (Object.keys(acoesPorDesignado).length === 0) {
            kanbanBoard.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1;">Nenhuma ação encontrada</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar kanban:', error);
        document.getElementById('kanbanBoard').innerHTML = '<p style="text-align: center; color: #dc3545;">Erro ao carregar ações</p>';
    }
}

// Função para criar uma coluna do kanban
function criarColunaKanban(designado, acoes) {
    const coluna = document.createElement('div');
    coluna.className = 'kanban-column';

    const header = document.createElement('div');
    header.className = 'kanban-column-header';

    const title = document.createElement('div');
    title.className = 'kanban-column-title';
    title.textContent = designado;

    const count = document.createElement('div');
    count.className = 'kanban-column-count';
    count.textContent = acoes.length;

    header.appendChild(title);
    header.appendChild(count);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards';

    // Criar cards para cada ação
    acoes.forEach(acao => {
        const card = criarCardAcao(acao);
        cardsContainer.appendChild(card);
    });

    coluna.appendChild(header);
    coluna.appendChild(cardsContainer);

    return coluna;
}

// Função para criar um card de ação
function criarCardAcao(acao) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.onclick = () => abrirDetalhesAcao(acao.id);

    const statusClass = acao.status.replace(/\s+/g, '-').toLowerCase();
    const dataFormatada = new Date(acao.data_criacao).toLocaleDateString('pt-BR');

    card.innerHTML = `
        <div class="kanban-card-title">${acao.titulo}</div>
        <div class="kanban-card-cliente">👤 ${acao.cliente}</div>
        <div class="kanban-card-status status-${statusClass}">${acao.status}</div>
        <div class="kanban-card-meta">
          <span class="kanban-card-criador">Por: ${acao.criador}</span>
          <span class="kanban-card-data">${dataFormatada}</span>
        </div>
      `;

    return card;
}

// Função para abrir detalhes da ação (placeholder)
async function abrirDetalhesAcao(acaoId) {
    // Buscar arquivos e status da ação pela nova rota
    try {
        // Buscar arquivos
        const respArq = await fetch(`/api/acoes/arquivos/${acaoId}`);
        const arquivosPorTipo = await respArq.json();
        // Buscar status
        const respStatus = await fetch(`/api/acoes/status/${acaoId}`);
        const dadosStatus = await respStatus.json();
        mostrarModalDocumentosAcompanhamento(acaoId, arquivosPorTipo, dadosStatus.status);
    } catch (e) {
        alert('Erro ao buscar arquivos ou status da ação.');
    }
}

// Função para carregar o kanban de corrigir ações (apenas finalizadas)
async function carregarKanbanCorrigir() {
    try {
        const response = await fetch('/api/acoes?status=finalizado');
        const acoesPorDesignado = await response.json();
        const kanbanBoard = document.getElementById('kanbanBoardCorrigir');
        kanbanBoard.innerHTML = '';
        // Ordenar: 'Nenhum' primeiro, depois os demais em ordem alfabética
        const designados = Object.keys(acoesPorDesignado);
        designados.sort((a, b) => {
            if (a === 'Nenhum') return -1;
            if (b === 'Nenhum') return 1;
            return a.localeCompare(b, 'pt-BR');
        });
        designados.forEach(designado => {
            const acoes = acoesPorDesignado[designado];
            const coluna = criarColunaKanbanCorrigir(designado, acoes);
            kanbanBoard.appendChild(coluna);
        });
        if (Object.keys(acoesPorDesignado).length === 0) {
            kanbanBoard.innerHTML = '<p style="text-align: center; color: #666; grid-column: 1 / -1;">Nenhuma ação finalizada para corrigir</p>';
        }
    } catch (error) {
        document.getElementById('kanbanBoardCorrigir').innerHTML = '<p style="text-align: center; color: #dc3545;">Erro ao carregar ações</p>';
    }
}

// Coluna e card para corrigir (idêntico, mas chama modalCorrigir)
function criarColunaKanbanCorrigir(designado, acoes) {
    const coluna = document.createElement('div');
    coluna.className = 'kanban-column';
    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    const title = document.createElement('div');
    title.className = 'kanban-column-title';
    title.textContent = designado;
    const count = document.createElement('div');
    count.className = 'kanban-column-count';
    count.textContent = acoes.length;
    header.appendChild(title);
    header.appendChild(count);
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards';
    acoes.forEach(acao => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.onclick = () => abrirDetalhesAcaoCorrigir(acao.id);
        const statusClass = acao.status.replace(/\s+/g, '-').toLowerCase();
        const dataFormatada = new Date(acao.data_criacao).toLocaleDateString('pt-BR');
        let aprovadoSelo = '';
        if (acao.data_aprovado) {
            aprovadoSelo = `<span class='kanban-aprovado-selo'>Aprovado</span>`;
        }
        card.innerHTML = `
          <div class="kanban-card-title">${acao.titulo}</div>
          <div class="kanban-card-cliente">👤 ${acao.cliente}</div>
          <div class="kanban-card-status status-${statusClass}">${acao.status} ${aprovadoSelo}</div>
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

// Modal de corrigir ação (idêntico, mas com botão Aprovar)
async function abrirDetalhesAcaoCorrigir(acaoId) {
    // Buscar arquivos e status da ação pela nova rota
    try {
        // Buscar arquivos
        const respArq = await fetch(`/api/acoes/arquivos/${acaoId}`);
        const arquivosPorTipo = await respArq.json();
        // Buscar status
        const respStatus = await fetch(`/api/acoes/status/${acaoId}`);
        const dadosStatus = await respStatus.json();
        mostrarModalDocumentosAcompanhamento(acaoId, arquivosPorTipo, dadosStatus.status, true);
    } catch (e) {
        alert('Erro ao buscar arquivos ou status da ação.');
    }
}

function mostrarModalDocumentosAcompanhamento(acaoId, arquivosPorTipo, statusAtual, modoCorrigir) {
    const modal = document.getElementById('modalDocumentos');
    const lista = document.getElementById('modalDocsLista');
    lista.innerHTML = '';
    // Campo de status editável na mesma linha do título do modal
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

    // Exibir comentário se existir e não for modo de correção
    let comentarioInfo = document.getElementById('modalComentarioInfo');
    if (comentarioInfo) comentarioInfo.remove();
    if (!modoCorrigir) {
        // Buscar o comentário da ação
        fetch(`/api/acoes/comentario/${acaoId}`)
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

    // Adicionar campo de comentário se for modo de correção
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
          <small style="color:#888;">(Preencha este campo ao devolver para o estagiário)</small>
        `;
        modalContent.insertBefore(comentarioBox, modalContent.querySelector('#modalDocsLista'));
    }

    // Preencher lista de designados
    fetch('/api/designados').then(r => r.json()).then(designados => {
        const select = document.getElementById('modalDesignadoSelect');
        select.innerHTML = '<option value="Nenhum">Nenhum</option>';
        designados.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.nome;
            opt.textContent = e.nome;
            select.appendChild(opt);
        });
        // Setar valor atual
        select.value = window.__modalDesignadoAtual || 'Nenhum';
    });
    // Setar valor atual do status
    setTimeout(() => {
        document.getElementById('modalStatusSelect').value = statusAtual;
    }, 50);
    // Salvar status/designado/arquivo
    document.getElementById('modalStatusSalvar').onclick = async () => {
        const novoStatus = document.getElementById('modalStatusSelect').value;
        const novoDesignado = document.getElementById('modalDesignadoSelect').value;
        const msg = document.getElementById('modalStatusMsg');
        msg.textContent = 'Salvando...';
        let statusOk = false;
        // Se for modo de correção e status está saindo de finalizado, enviar comentário
        let comentarioEnviado = false;
        let comentario = '';
        if (modoCorrigir && statusAtual === 'Finalizado' && novoStatus !== 'Finalizado') {
            comentario = document.getElementById('modalComentario').value.trim();
            if (comentario.length > 0) {
                const respComentario = await fetch(`/api/acoes/comentario/${acaoId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comentario })
                });
                comentarioEnviado = respComentario.ok;
            } else {
                msg.textContent = 'Por favor, escreva um comentário para devolução.';
                return;
            }
        }
        // Salvar status e designado
        const resp = await fetch(`/api/acoes/status/${acaoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus, designado: novoDesignado })
        });
        if (resp.ok) {
            statusOk = true;
        }
        // Salvar arquivos de todos os tipos, se houver
        let arquivoOk = true;
        const tiposUpload = [
            { campo: 'modalContratoUpload', rota: '/api/acoes/upload-contrato' },
            { campo: 'modalDocumentacaoUpload', rota: '/api/acoes/upload-documentacao' },
            { campo: 'modalProvasUpload', rota: '/api/acoes/upload-provas' },
            { campo: 'modalAcaoUpload', rota: '/api/acoes/upload-acao' }
        ];
        for (const tipo of tiposUpload) {
            const input = document.getElementById(tipo.campo);
            if (input && input.files && input.files.length) {
                const formData = new FormData();
                formData.append('acao_id', acaoId);
                formData.append('arquivo', input.files[0]);
                const respArq = await fetch(tipo.rota, {
                    method: 'POST',
                    body: formData
                });
                arquivoOk = arquivoOk && respArq.ok;
            }
        }
        if (statusOk && arquivoOk && (!modoCorrigir || novoStatus === 'Finalizado' || comentarioEnviado)) {
            msg.textContent = 'Salvo!';
            // Fechar o modal imediatamente após salvar
            document.getElementById('modalDocumentos').style.display = 'none';
            setTimeout(() => { msg.textContent = ''; }, 1200);
            if (modoCorrigir) {
                carregarKanbanCorrigir();
            } else {
                carregarKanban();
            }
        } else {
            msg.textContent = 'Erro ao salvar';
        }
    };
    // Botão Aprovar (corrigir)
    if (modoCorrigir) {
        document.getElementById('modalAprovar').onclick = async () => {
            const msg = document.getElementById('modalStatusMsg');
            msg.textContent = 'Aprovando...';
            const resp = await fetch(`/api/acoes/aprovar/${acaoId}`, { method: 'POST' });
            if (resp.ok) {
                msg.textContent = 'Aprovado!';
                // Fechar o modal imediatamente após aprovar
                document.getElementById('modalDocumentos').style.display = 'none';
                setTimeout(() => { msg.textContent = ''; }, 1200);
                carregarKanbanCorrigir();
            } else {
                msg.textContent = 'Erro ao aprovar';
            }
        };
    }
    // Mapear nomes para títulos
    // Descobrir designado atual (para setar no select)
    window.__modalDesignadoAtual = arquivosPorTipo && arquivosPorTipo.__designadoAtual ? arquivosPorTipo.__designadoAtual : 'Nenhum';
    const tipos = {
        'Contrato': arquivosPorTipo.Contrato || [],
        'Documentação': arquivosPorTipo.Documentacao || [],
        'Provas': arquivosPorTipo.Provas || [],
        'Ação': arquivosPorTipo.Acao || []
    };
    // Container dos blocos
    const blocos = document.createElement('div');
    blocos.className = 'modal-docs-tipos';
    Object.entries(tipos).forEach(([titulo, listaArqs]) => {
        const bloco = document.createElement('div');
        bloco.className = 'modal-docs-bloco';
        bloco.innerHTML = `<div class='modal-docs-bloco-titulo'>${titulo}</div>`;
        // Upload para qualquer tipo se não houver arquivo
        if (listaArqs.length === 0) {
            const tipoCampo =
                titulo === 'Contrato' ? 'modalContratoUpload' :
                    titulo === 'Documentação' ? 'modalDocumentacaoUpload' :
                        titulo === 'Provas' ? 'modalProvasUpload' :
                            titulo === 'Ação' ? 'modalAcaoUpload' : '';
            const uploadDrop = document.createElement('div');
            uploadDrop.className = 'modal-docs-upload-drop';
            uploadDrop.innerHTML = `
            <span class=\"icon\">📎</span>
            <span id=\"${tipoCampo}Label\">Arraste o arquivo aqui ou clique para selecionar</span>
            <span class=\"file-name\" id=\"${tipoCampo}Nome\"></span>
            <input type='file' id='${tipoCampo}' accept='.pdf,.doc,.docx,.png,.jpg,.jpeg' style='display:none;'>
          `;
            bloco.appendChild(uploadDrop);
            // Lógica de upload visual
            const input = uploadDrop.querySelector(`#${tipoCampo}`);
            const nomeSpan = uploadDrop.querySelector(`#${tipoCampo}Nome`);
            uploadDrop.onclick = () => input.click();
            input.addEventListener('change', () => {
                if (input.files.length) {
                    nomeSpan.textContent = input.files[0].name;
                } else {
                    nomeSpan.textContent = '';
                }
            });
            // Drag and drop
            uploadDrop.addEventListener('dragover', function (e) {
                e.preventDefault();
                uploadDrop.classList.add('dragover');
            });
            uploadDrop.addEventListener('dragleave', function (e) {
                uploadDrop.classList.remove('dragover');
            });
            uploadDrop.addEventListener('drop', function (e) {
                e.preventDefault();
                uploadDrop.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    input.files = e.dataTransfer.files;
                    nomeSpan.textContent = input.files[0].name;
                }
            });
        }
        const arqsDiv = document.createElement('div');
        arqsDiv.className = 'modal-docs-arquivos';
        if (listaArqs.length === 0) {
            arqsDiv.innerHTML = `<div style='color:#888'>Nenhum arquivo.</div>`;
        } else {
            listaArqs.forEach(arq => {
                const card = document.createElement('div');
                card.className = 'modal-docs-arquivo-card';
                card.innerHTML = `
              <span class='modal-docs-arquivo-icon'>📄</span>
              <span class='modal-docs-arquivo-nome'>${arq.nome.replace(/^(CON|DOC|PROV|ACAO) - /, '')}</span>
              <a class='modal-docs-arquivo-link' href="${arq.path.replace(/^.*public/, '')}" target="_blank" title="Baixar">⬇️</a>
              <button class='modal-docs-arquivo-remove' title='Excluir' style='margin-left:0.7rem;color:#e53e3e;background:none;border:none;font-size:1.2em;cursor:pointer;font-weight:bold;'>×</button>
            `;
                // Evento de remover
                card.querySelector('.modal-docs-arquivo-remove').onclick = async (ev) => {
                    ev.stopPropagation();
                    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
                    const resp = await fetch('/api/acoes/remover-arquivo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ acaoId: acaoId, nomeArquivo: arq.nome })
                    });
                    if (resp.ok) {
                        abrirDetalhesAcaoCorrigir(acaoId);
                    } else {
                        alert('Erro ao remover arquivo!');
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

// Função para buscar clientes e estagiários (exemplo, ajustar para seu backend)
async function carregarOpcoes() {
    // Buscar clientes
    const clientes = await fetch('/api/clientes').then(r => r.json()).catch(() => []);
    const selectCliente = document.getElementById('cliente');
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nome + ' - ' + c.cpf_cnpj;
        selectCliente.appendChild(opt);
    });
    // Buscar estagiários
    const designados = await fetch('/api/designados').then(r => r.json()).catch(() => []);
    const selectdesignado = document.getElementById('designado');
    designados.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nome;
        selectdesignado.appendChild(opt);
    });
}
carregarOpcoes();

// Envio do formulário
document.getElementById('formAcao').addEventListener('submit', async function (e) {
    e.preventDefault();

    // Criar FormData para enviar dados e arquivos
    const formData = new FormData();

    // Dados básicos
    formData.append('cliente_id', document.getElementById('cliente').value);
    formData.append('designado_id', document.getElementById('designado').value);
    formData.append('status', document.getElementById('status').value);
    formData.append('titulo', document.getElementById('titulo').value);

    // Arquivos
    const contratoFiles = document.getElementById('contratoArquivo').files;
    const documentacaoFiles = document.getElementById('documentacaoArquivo').files;
    const provasFiles = document.getElementById('provasArquivo').files;

    // Adicionar arquivos com campos separados para cada tipo
    for (let i = 0; i < contratoFiles.length; i++) {
        formData.append('contratoArquivo', contratoFiles[i]);
    }
    for (let i = 0; i < documentacaoFiles.length; i++) {
        formData.append('documentacaoArquivo', documentacaoFiles[i]);
    }
    for (let i = 0; i < provasFiles.length; i++) {
        formData.append('provasArquivo', provasFiles[i]);
    }

    const resp = await fetch('/api/acoes', {
        method: 'POST',
        body: formData
    });

    const data = await resp.json();

    if (resp.ok) {
        this.reset();
        // Limpar listas de arquivos
        document.getElementById('contratoArquivoLista').innerHTML = '';
        document.getElementById('documentacaoArquivoLista').innerHTML = '';
        document.getElementById('provasArquivoLista').innerHTML = '';
        // Exibir pop-up de sucesso
        mostrarPopupAcaoCriada(data.mensagem || 'Ação criada com sucesso!');
    } else {
        document.getElementById('mensagem').textContent = data.mensagem || 'Erro ao criar ação';
        document.getElementById('mensagem').style.color = '#dc3545';
    }
});

// Feedback visual ao enviar
const form = document.getElementById('formAcao');
const mensagem = document.getElementById('mensagem');
form.addEventListener('submit', function () {
    mensagem.textContent = '';
});


// Gerenciamento de múltiplos arquivos e remoção
function atualizarListaArquivos(inputId, listaId) {
    const input = document.getElementById(inputId);
    const lista = document.getElementById(listaId);
    lista.innerHTML = '';
    if (input.files && input.files.length > 0) {
        Array.from(input.files).forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'file-list-item';
            item.innerHTML = `<span>${file.name}</span><button type="button" class="remove-file" title="Remover" data-idx="${idx}">×</button>`;
            lista.appendChild(item);
        });
        // Adiciona evento de remoção
        lista.querySelectorAll('.remove-file').forEach(btn => {
            btn.onclick = function (e) {
                e.stopPropagation();
                removerArquivo(inputId, parseInt(btn.getAttribute('data-idx')));
            };
        });
    }
}

function removerArquivo(inputId, idx) {
    const input = document.getElementById(inputId);
    const dt = new DataTransfer();
    Array.from(input.files).forEach((file, i) => {
        if (i !== idx) dt.items.add(file);
    });
    input.files = dt.files;
    // Atualiza lista
    atualizarListaArquivos(inputId, inputId + 'Lista');
}

document.getElementById('contratoArquivo').addEventListener('change', function () {
    atualizarListaArquivos('contratoArquivo', 'contratoArquivoLista');
});
document.getElementById('documentacaoArquivo').addEventListener('change', function () {
    atualizarListaArquivos('documentacaoArquivo', 'documentacaoArquivoLista');
});
document.getElementById('provasArquivo').addEventListener('change', function () {
    atualizarListaArquivos('provasArquivo', 'provasArquivoLista');
});

// Drag and drop para cada campo
function setupDrop(dropId, inputId, labelId) {
    const drop = document.getElementById(dropId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    drop.addEventListener('dragover', function (e) {
        e.preventDefault();
        drop.classList.add('dragover');
    });
    drop.addEventListener('dragleave', function (e) {
        drop.classList.remove('dragover');
    });
    drop.addEventListener('drop', function (e) {
        e.preventDefault();
        drop.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Adiciona arquivos ao input mantendo os já existentes
            const dt = new DataTransfer();
            Array.from(input.files).forEach(f => dt.items.add(f));
            Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
            input.files = dt.files;
            atualizarListaArquivos(inputId, inputId + 'Lista');
        }
    });
}
setupDrop('drop-contrato', 'contratoArquivo', 'contratoArquivoLabel');
setupDrop('drop-documentacao', 'documentacaoArquivo', 'documentacaoArquivoLabel');
setupDrop('drop-provas', 'provasArquivo', 'provasArquivoLabel');


// Função para mostrar notificação toast no canto inferior esquerdo
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
