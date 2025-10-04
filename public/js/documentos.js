let clientes = [];
let dadosClienteSelecionado = null;

// CARREGAR LISTA DE CLIENTES
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

// CARREGAR DADOS DO CLIENTE PARA SER USADO NOS DOCUMENTOS SEREM GERADOS
function carregarDadosCliente() {
  const clienteId = document.getElementById('cliente_id').value;
  if (clienteId) {
    dadosClienteSelecionado = clientes.find(c => c.id == clienteId);
    console.log('Cliente selecionado:', dadosClienteSelecionado);
  } else {
    dadosClienteSelecionado = null;
  }
}

// GERAR OS 4 DOCUMENTOS - CONTRATO, DECLARAÇÃO, PROCURAÇÃO E FICHA
async function gerarDocumentos() {
  const form = document.getElementById('documentoForm');
  const box = document.getElementById('docs-resultado');
  if (!form || !box) {
    console.error('documentoForm ou docs-resultado não encontrado.');
    return;
  }

  // injeta CSS uma única vez (sem estilos de copiar/abrir)
  (function ensureDocsStyles() {
    if (document.getElementById('td-docs-styles')) return;
    const css = `
    /* ======= Themis Data - Docs UI ======= */
    .td-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px;box-shadow:0 6px 20px rgba(2,6,23,.06)}
    .td-card-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .td-card-title{font-weight:700;color:#0f172a;font-size:15px;margin:0;display:flex;align-items:center;gap:8px}
    .td-doc-number{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f5f9;color:#0f172a;border:1px dashed #cbd5e1;padding:4px 8px;border-radius:10px;font-size:12px}
    .td-doc-list{list-style:none;margin:0;padding:0;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
    .td-doc-item{display:flex;align-items:center;gap:12px;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;background:linear-gradient(180deg,#fff,#fcfcfd);transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease}
    .td-doc-item:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(2,6,23,.07);border-color:#dbe3ea}
    .td-doc-icon{flex:0 0 auto;font-size:22px;line-height:1;background:#f1f5f9;border:1px solid #e2e8f0;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center}
    .td-doc-info{min-width:0;flex:1 1 auto}
    .td-doc-title{margin:0;font-weight:600;color:#0f172a;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .td-doc-sub{margin:2px 0 0 0;color:#475569;font-size:12px;display:flex;align-items:center;gap:8px}
    .td-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid #e2e8f0;background:#f8fafc;color:#0f172a}
    .td-ext{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#475569}
    .td-doc-actions{display:flex;gap:6px;flex-wrap:wrap}
    .td-btn{appearance:none;border:1px solid transparent;border-radius:10px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;transition:all .12s ease;line-height:1.1;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
    .td-btn:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
    .td-btn-primary{background:#1d4ed8;color:#fff}.td-btn-primary:hover{background:#1b46c4}
    .td-btn-outline{background:#fff;border-color:#cbd5e1;color:#0f172a}.td-btn-outline:hover{background:#f8fafc;border-color:#94a3b8}
    .td-skel{display:grid;gap:10px}
    .td-skel .b{height:40px;border-radius:12px;background:linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9);background-size:200% 100%;animation:tdShimmer 1.2s infinite}
    @keyframes tdShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    `;
    const el = document.createElement('style');
    el.id = 'td-docs-styles';
    el.textContent = css;
    document.head.appendChild(el);
  })();

  const get = (name) => (form.elements[name]?.value ?? '').trim();

  // valida se o cliente foi realmente escolhido da lista
  const cliente_id = (document.getElementById('cliente_id')?.value || '').trim();
  if (!cliente_id) {
    alert('Selecione um cliente da lista (autocomplete).');
    document.getElementById('clienteBusca')?.focus();
    return;
  }

  // payload (mantém data em yyyy-mm-dd pro back formatar)
  const payload = {
    cliente_id,
    objeto_acao: get('objeto_acao'),
    tipo_acao: get('tipo_acao'),
    requerido: get('requerido'),
    atendido_por: get('atendido_por'),
    data_atendimento: get('data_atendimento'),
    indicador: get('indicador'),
  };

  // loading state e prevenção de duplo submit
  const submitBtn = form.querySelector('[type="submit"]');
  const prevBtnHTML = submitBtn?.innerHTML;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Gerando…';
  }
  box.innerHTML = `
    <div class="td-card">
      <div class="td-card-header">
        <h3 class="td-card-title">📁 Gerando documentos…</h3>
        <span class="td-doc-number">aguarde</span>
      </div>
      <div class="td-skel">
        <div class="b"></div><div class="b"></div><div class="b"></div>
      </div>
    </div>
  `;

  // helpers locais
  const iconFor = (tipo = '') => {
    const t = tipo.toLowerCase();
    if (t.includes('procura')) return '🖋️';
    if (t.includes('declara')) return '📝';
    if (t.includes('ficha')) return '📋';
    return '📄';
  };
  const extOf = (nome = '') => (nome.match(/\.([a-z0-9]{2,6})$/i)?.[1] || 'docx').toUpperCase();

  try {
    const resp = await fetch('/api/documentos/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data?.sucesso) {
      box.innerHTML = `
        <div class="td-card">
          <div class="td-card-header">
            <h3 class="td-card-title">❌ Erro ao gerar</h3>
          </div>
          <p style="margin:0;color:#dc2626">${(data && data.mensagem) || 'Falha ao gerar documentos.'}</p>
        </div>
      `;
      return;
    }

    const docs = Array.isArray(data.documentos) ? data.documentos : [];
    const items = docs.map(doc => `
      <li class="td-doc-item">
        <div class="td-doc-icon" aria-hidden="true">${iconFor(doc.tipo)}</div>
        <div class="td-doc-info">
          <p class="td-doc-title" title="${doc.nomeArquivo}">${doc.tipo}</p>
          <p class="td-doc-sub">
            <span class="td-chip">${doc.tipo}</span>
            <span class="td-ext">.${extOf(doc.nomeArquivo)}</span>
          </p>
        </div>
        <div class="td-doc-actions">
          <a class="td-btn td-btn-primary" href="${doc.url}" download="${doc.nomeArquivo}">Baixar</a>
        </div>
      </li>
    `).join('');

    box.innerHTML = `
      <div class="td-card" role="region" aria-label="Documentos gerados">
        <div class="td-card-header">
          <h3 class="td-card-title">📁 Documentos gerados</h3>
          <span class="td-doc-number" title="Número do Documento">${data.numero_documento || '-'}</span>
        </div>
        ${docs.length ? `<ul class="td-doc-list">${items}</ul>`
        : `<p style="margin:8px 0 0;color:#64748b">Nenhum documento retornado.</p>`}
      </div>
    `;

  } catch (err) {
    console.error(err);
    box.innerHTML = `
      <div class="td-card">
        <div class="td-card-header">
          <h3 class="td-card-title">❌ Erro inesperado</h3>
        </div>
        <p style="margin:0;color:#dc2626">Erro inesperado ao gerar documentos.</p>
      </div>
    `;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = prevBtnHTML || 'Gerar';
    }
  }
}

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

// ======== Utils ========
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const consultarClientes = debounce(async (term) => {
  idEl.value = '';                 // limpa seleção ao digitar novamente
  if (!term || term.trim().length < 2) {
    renderSugestoes([]);
    return;
  }
  const q = encodeURIComponent(term.trim());
  try {
    const resp = await fetch(`/api/clientes/documentos?q=${q}`);
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

