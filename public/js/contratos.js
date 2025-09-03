let clientes = [];
let dadosClienteSelecionado = null;

// Funções de navegação
function showTab(tabName) {
  // Esconder todas as abas
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Mostrar aba selecionada
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');

  // Carregar dados se for a aba de histórico
  if (tabName === 'historico') {
    carregarContratos();
  }
}

// Carregar clientes
async function carregarClientes() {
  try {
    const response = await fetch('/api/clientes');
    clientes = await response.json();

    const select = document.getElementById('cliente_id');
    select.innerHTML = '<option value="">Selecione um cliente...</option>';

    clientes.forEach(cliente => {
      const option = document.createElement('option');
      option.value = cliente.id;
      option.textContent = `${cliente.nome} - ${cliente.cpf_cnpj}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
  }
}

function carregarDadosCliente() {
  const clienteId = document.getElementById('cliente_id').value;
  if (clienteId) {
    dadosClienteSelecionado = clientes.find(c => c.id == clienteId);
    console.log('Cliente selecionado:', dadosClienteSelecionado);
  } else {
    dadosClienteSelecionado = null;
  }
}

// Preview do contrato
async function previewContrato() {
  const form = document.getElementById('contratoForm');
  const formData = new FormData(form);

  const dados = {
    cliente_id: formData.get('cliente_id'),
    acao: formData.get('acao')
  };

  if (!dados.cliente_id) {
    alert('Por favor, selecione um cliente.');
    return;
  }

  try {
    const response = await fetch('/api/contratos/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });

    const resultado = await response.json();

    if (resultado.sucesso) {
      // Criar modal para mostrar o preview
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
            <div class="modal-content">
              <div class="modal-header">
                <h3>Preview do Contrato</h3>
                <span class="close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
              </div>
              <div class="modal-body">
                <div style="white-space: pre-wrap; font-family: 'Times New Roman', serif; line-height: 1.6; padding: 20px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 5px; max-height: 400px; overflow-y: auto;">
                  ${resultado.preview}
                </div>
              </div>
              <div class="modal-footer">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">Fechar</button>
              </div>
            </div>
          `;

      document.body.appendChild(modal);

    } else {
      alert('Erro ao gerar preview: ' + resultado.mensagem);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao gerar preview. Verifique a conexão com o servidor.');
  }
}

// Gerar contrato
async function gerarContrato() {
  const form = document.getElementById('contratoForm');
  const formData = new FormData(form);

  const dados = {
    cliente_id: formData.get('cliente_id'),
    acao: formData.get('acao')
  };

  if (!dados.cliente_id) {
    alert('Por favor, selecione um cliente.');
    return;
  }

  try {
    const response = await fetch('/api/contratos/gerar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });

    const resultado = await response.json();

    if (resultado.sucesso) {
      alert('Contrato gerado com sucesso!');
      // Abrir o arquivo gerado em nova aba
      window.open(resultado.arquivo, '_blank');
      // Limpar formulário
      form.reset();
    } else {
      alert('Erro ao gerar contrato: ' + resultado.mensagem);
    }
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao gerar contrato. Verifique a conexão com o servidor.');
  }
}

// Carregar histórico de contratos
async function carregarContratos() {
  try {
    const response = await fetch('/api/contratos');
    const contratos = await response.json();

    const tbody = document.getElementById('contratosTableBody');
    tbody.innerHTML = '';

    contratos.forEach(contrato => {
      const row = document.createElement('tr');
      row.innerHTML = `
            <td>${contrato.contrato}</td>
            <td>${contrato.cliente_nome}</td>
            <td>${contrato.acao}</td>
            <td>${new Date(contrato.data_geracao).toLocaleDateString()}</td>
              <div class="action-buttons">
                <button class="btn btn-info btn-sm" onclick="downloadContrato(${contrato.id})">Download</button>
              </div>
            </td>
          `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Erro ao carregar contratos:', error);
  }
}

async function downloadContrato(id) {
  try {
    // Fazer download do arquivo
    const response = await fetch(`/api/contratos/${id}/download`);

    if (!response.ok) {
      const error = await response.json();
      alert('Erro ao fazer download: ' + error.mensagem);
      return;
    }

    // Criar blob e fazer download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrato-${id}.docx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (error) {
    console.error('Erro ao fazer download:', error);
    alert('Erro ao fazer download do contrato. Verifique a conexão com o servidor.');
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
  console.log('Página de contratos carregada!');
  carregarClientes();
});

// ======== Utils ========
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const onlyDigits = s => (s || '').replace(/\D+/g, '');

// ======== Autocomplete Cliente ========
const buscaEl = document.getElementById('clienteBusca');
const idEl = document.getElementById('cliente_id');
const listEl = document.getElementById('clienteSugestoes');
const boxEl = document.getElementById('cliente-autocomplete');

let sugestoes = [];
let activeIndex = -1;

function renderSugestoes(items) {
  listEl.innerHTML = '';
  if (!items.length) { listEl.hidden = true; return; }
  items.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
        <span class="sug-nome">${c.nome}</span>
        <span class="sug-doc">${c.cpf_cnpj || ''}</span>
      `;
    li.addEventListener('click', () => escolherCliente(c));
    li.addEventListener('mousemove', () => setActive(i));
    listEl.appendChild(li);
  });
  listEl.hidden = false;
  activeIndex = -1;
}

function setActive(i) {
  const lis = [...listEl.querySelectorAll('li')];
  lis.forEach(el => el.classList.remove('active'));
  if (i >= 0 && i < lis.length) {
    lis[i].classList.add('active');
    activeIndex = i;
    // garante visibilidade ao navegar com setas
    const el = lis[i];
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < listEl.scrollTop) listEl.scrollTop = top;
    else if (bottom > listEl.scrollTop + listEl.clientHeight)
      listEl.scrollTop = bottom - listEl.clientHeight;
  }
}

function escolherCliente(c) {
  buscaEl.value = `${c.nome} - ${c.cpf_cnpj || ''}`.trim();
  idEl.value = c.id;               // isso é o que o backend precisa
  listEl.hidden = true;
}

const consultarClientes = debounce(async (term) => {
  idEl.value = '';                 // limpa seleção ao digitar novamente
  if (!term || term.trim().length < 2) {
    renderSugestoes([]);
    return;
  }
  const q = encodeURIComponent(term.trim());
  try {
    const resp = await fetch(`/api/clientes/contratos?q=${q}`);
    sugestoes = await resp.json();
    renderSugestoes(sugestoes);
  } catch (e) {
    console.error('Erro ao buscar clientes:', e);
    renderSugestoes([]);
  }
}, 300);

buscaEl.addEventListener('input', (e) => consultarClientes(e.target.value));

// Teclado: ↑/↓ navega, Enter escolhe, Esc fecha
buscaEl.addEventListener('keydown', (e) => {
  if (listEl.hidden) return;
  const max = sugestoes.length;
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive((activeIndex + 1) % max); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((activeIndex - 1 + max) % max); }
  else if (e.key === 'Enter') {
    if (activeIndex >= 0 && activeIndex < sugestoes.length) {
      e.preventDefault();
      escolherCliente(sugestoes[activeIndex]);
    }
  } else if (e.key === 'Escape') {
    listEl.hidden = true;
  }
});

// Fecha lista ao clicar fora
document.addEventListener('click', (e) => {
  if (!boxEl.contains(e.target)) listEl.hidden = true;
});

// ======== Validação antes de enviar ========
// Garante que cliente_id esteja preenchido
function validarClienteSelecionado() {
  if (!idEl.value) {
    alert('Selecione um cliente da lista.');
    buscaEl.focus();
    return false;
  }
  return true;
}

// Intercepta os botões já existentes
const oldPreview = window.previewContrato;
window.previewContrato = function () {
  if (!validarClienteSelecionado()) return;
  oldPreview();
}
const oldGerar = window.gerarContrato;
window.gerarContrato = function () {
  if (!validarClienteSelecionado()) return;
  oldGerar();
}