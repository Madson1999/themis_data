/**
 * public/js/documentos.js
 * ----------------------------------------
 * Frontend de Documentos — SaaS multi-tenant.
 * - Envia o cabeçalho `x-tenant-id` (lido do cookie `tenant_id`, quando disponível)
 * - Autocomplete de clientes (busca em /api/clientes/documentos)
 * - GERAR: download imediato (DOCX único ou ZIP) — POST /api/documentos/gerar
 */

let clientes = [];
let dadosClienteSelecionado = null;

/* =============== helpers de tenant/cookies =============== */
function getCookie(name) {
  const m = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
  );
  return m ? decodeURIComponent(m[1]) : null;
}
function getTenantHeaders() {
  const t = getCookie('tenant_id');
  return t ? { 'x-tenant-id': t } : {};
}

/* =============== LISTA COMPLETA (fallback) =============== */
async function carregarClientes() {
  try {
    const response = await fetch('/api/clientes', {
      headers: { ...getTenantHeaders() },
      credentials: 'same-origin',
    });
    clientes = await response.json();

    const select = document.getElementById('cliente_id');
    if (!select) return;
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
  const clienteId = document.getElementById('cliente_id')?.value;
  if (clienteId) {
    dadosClienteSelecionado = clientes.find(c => String(c.id) === String(clienteId)) || null;
    console.log('Cliente selecionado:', dadosClienteSelecionado);
  } else {
    dadosClienteSelecionado = null;
  }
}

/* ==================== helpers download ==================== */
function filenameFromContentDisposition(cd) {
  if (!cd) return null;
  // Ex.: attachment; filename="doc-123.docx"; filename*=UTF-8''doc-123.docx
  const fnStar = /filename\*\s*=\s*[^']*''([^;]+)/i.exec(cd);
  if (fnStar && fnStar[1]) return decodeURIComponent(fnStar[1]);
  const fn = /filename\s*=\s*"(.*?)"/i.exec(cd) || /filename\s*=\s*([^;]+)/i.exec(cd);
  if (fn && fn[1]) return fn[1].replace(/["']/g, '').trim();
  return null;
}

function triggerDownload(blob, filenameFallback = 'documento') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFallback;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function safe(v) {
  return (v || '').toString().trim();
}

/* =============== GERAR (download imediato) =============== */
async function gerarDocumentos(e) {
  if (e) e.preventDefault();

  const form = document.getElementById('documentoForm');
  const box = document.getElementById('docs-resultado');
  if (!form || !box) {
    console.error('documentoForm ou docs-resultado não encontrado.');
    return;
  }

  // injeta CSS uma única vez
  (function ensureDocsStyles() {
    if (document.getElementById('td-docs-styles')) return;
    const css = `
    .td-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px;box-shadow:0 6px 20px rgba(2,6,23,.06)}
    .td-card-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .td-card-title{font-weight:700;color:#0f172a;font-size:15px;margin:0;display:flex;align-items:center;gap:8px}
    .td-doc-number{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f5f9;color:#0f172a;border:1px dashed #cbd5e1;padding:4px 8px;border-radius:10px;font-size:12px}
    .td-skel{display:grid;gap:10px}
    .td-skel .b{height:40px;border-radius:12px;background:linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9);background-size:200% 100%;animation:tdShimmer 1.2s infinite}
    @keyframes tdShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .td-ok{color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;padding:8px 10px;border-radius:10px;font-weight:600}
    .td-err{color:#991b1b;background:#fef2f2;border:1px solid #fecaca;padding:8px 10px;border-radius:10px;font-weight:600}
    `;
    const el = document.createElement('style');
    el.id = 'td-docs-styles';
    el.textContent = css;
    document.head.appendChild(el);
  })();

  const get = (name) => (form.elements[name]?.value ?? '').trim();

  // valida cliente escolhido (do autocomplete)
  const cliente_id = (document.getElementById('cliente_id')?.value || '').trim();
  if (!cliente_id) {
    alert('Selecione um cliente da lista (autocomplete).');
    document.getElementById('clienteBusca')?.focus();
    return;
  }

  const objeto_acao = get('objeto_acao') || get('acao'); // compat antigo
  const payload = {
    cliente_id,
    objeto_acao,
    tipo_acao: get('tipo_acao'),
    requerido: get('requerido'),
    atendido_por: get('atendido_por'),
    data_atendimento: get('data_atendimento'), // yyyy-mm-dd
    indicador: get('indicador'),
  };

  // loading
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

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/octet-stream, application/zip, application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ...getTenantHeaders(),
    };

    const resp = await fetch('/api/documentos/gerar', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    const ct = resp.headers.get('Content-Type') || '';

    // Se voltar JSON, trata como erro/mensagem do back
    if (ct.includes('application/json')) {
      const data = await resp.json().catch(() => ({}));
      const msg = data?.mensagem || data?.error || 'Falha ao gerar documentos.';
      box.innerHTML = `
        <div class="td-card">
          <div class="td-card-header">
            <h3 class="td-card-title">❌ Erro ao gerar</h3>
          </div>
          <p class="td-err" style="margin:0">${msg}</p>
        </div>
      `;
      return;
    }

    // Caso de sucesso: binário (DOCX ou ZIP)
    const blob = await resp.blob();
    // tenta extrair filename do header
    let filename = filenameFromContentDisposition(resp.headers.get('Content-Disposition'));

    if (!filename) {
      // fallback amigável
      const isZip = (ct.includes('zip') || blob.type === 'application/zip');
      const base = safe(payload.numero_documento) || safe(objeto_acao) || 'documento';
      filename = (base.replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-') || 'documento') + (isZip ? '.zip' : '.docx');
    }

    // dispara o download
    triggerDownload(blob, filename);

    // feedback visual
    box.innerHTML = `
      <div class="td-card">
        <div class="td-card-header">
          <h3 class="td-card-title">✅ Download iniciado</h3>
          <span class="td-doc-number">${filename}</span>
        </div>
        <p class="td-ok" style="margin:0">
          Se o download não começou, verifique o bloqueio de pop-ups ou tente novamente.
        </p>
      </div>
    `;
  } catch (err) {
    console.error(err);
    box.innerHTML = `
      <div class="td-card">
        <div class="td-card-header">
          <h3 class="td-card-title">❌ Erro inesperado</h3>
        </div>
        <p class="td-err" style="margin:0">Erro inesperado ao gerar/baixar o documento.</p>
      </div>
    `;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = prevBtnHTML || 'Gerar';
    }
  }
}

/* =============== AUTOCOMPLETE DE CLIENTES =============== */
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
    const el = lis[i];
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < listEl.scrollTop) listEl.scrollTop = top;
    else if (bottom > listEl.scrollTop + listEl.clientHeight)
      listEl.scrollTop = bottom - listEl.clientHeight;
  }
}

function escolherCliente(c) {
  buscaEl.value = `${c.nome} - ${c.cpf_cnpj || ''}`.trim();
  idEl.value = c.id; // backend usa este id
  listEl.hidden = true;
}

/* debounce util */
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const consultarClientes = debounce(async (term) => {
  idEl.value = ''; // limpa seleção ao digitar
  if (!term || term.trim().length < 2) {
    renderSugestoes([]);
    return;
  }
  const q = encodeURIComponent(term.trim());
  try {
    const resp = await fetch(`/api/clientes/documentos?q=${q}`, {
      headers: { ...getTenantHeaders() },
      credentials: 'same-origin',
    });
    sugestoes = await resp.json();
    renderSugestoes(sugestoes);
  } catch (e) {
    console.error('Erro ao buscar clientes:', e);
    renderSugestoes([]);
  }
}, 300);

buscaEl?.addEventListener('input', (e) => consultarClientes(e.target.value));

buscaEl?.addEventListener('keydown', (e) => {
  if (listEl.hidden) return;
  const max = sugestoes.length || 1;
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

/* fecha lista ao clicar fora */
document.addEventListener('click', (e) => {
  if (boxEl && !boxEl.contains(e.target)) listEl.hidden = true;
});

/* validação auxiliar se precisar usar no onsubmit */
function validarClienteSelecionado() {
  if (!idEl?.value) {
    alert('Selecione um cliente da lista.');
    buscaEl?.focus();
    return false;
  }
  return true;
}

/* exporta no escopo global se necessário */
window.gerarDocumentos = gerarDocumentos;
window.carregarClientes = carregarClientes;
window.carregarDadosCliente = carregarDadosCliente;
