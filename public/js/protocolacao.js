/* ========================================================================
 * PROTOCOLAÇÃO – Multi-Tenant
 *  - Usa X-Tenant-Id em todas as requisições
 *  - tenant_id vem do localStorage (definido no login) com fallback '1'
 * ===================================================================== */

/* ====== MULTI-TENANT: helper ====== */
const TENANT_ID = localStorage.getItem('tenant_id') || '1';
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

// ----- helpers -----
function formatarSomenteData(valor) {
    if (!valor) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const [y, m, d] = valor.split("-");
        return `${d}/${m}/${y}`;
    }
    const dt = new Date(valor);
    return isNaN(dt.getTime()) ? String(valor) : dt.toLocaleDateString('pt-BR');
}

const filtro = { dataAprovado: '', protocolado: 'nao' };

// ----- render tabela -----
async function carregarProtocolacao() {
    const tbody = document.getElementById('tabela-protocolacao');
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';

    try {
        const res = await fetchTenant('/api/protocolacao');
        let dados = await res.json();

        // precisa ter data_aprovado (SEM filtrar protocolado aqui!)
        dados = dados.filter(item => item.data_aprovado);

        // filtro por data (YYYY-MM-DD)
        if (filtro.dataAprovado) {
            dados = dados.filter(item => {
                const iso = /^\d{4}-\d{2}-\d{2}$/.test(item.data_aprovado)
                    ? item.data_aprovado
                    : new Date(item.data_aprovado).toISOString().split('T')[0];
                return iso === filtro.dataAprovado;
            });
        }

        // filtro de protocolado (novo select)
        if (filtro.protocolado !== 'todos') {
            const mostrarSoProtocolados = (filtro.protocolado === 'sim');
            dados = dados.filter(item => mostrarSoProtocolados ? item.protocolado : !item.protocolado);
        }

        tbody.innerHTML = '';

        if (dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">Nenhum registro encontrado</td></tr>';
            return;
        }

        dados.forEach(item => {
            const tr = document.createElement('tr');
            const isProt = item.protocolado;

            tr.innerHTML = `
        <td data-label="ID">${item.id}</td>
        <td data-label="Cliente">${item.cliente ?? ''}</td>
        <td data-label="Título">${item.titulo ?? ''}</td>
        <td data-label="Designado">${item.designado ?? ''}</td>
        <td data-label="Protocolado">
          ${isProt ? '<span class="badge badge-ok">✅ Protocolado</span>' : '<span class="badge badge-no">❌ Não Protocolado</span>'}
        </td>
        <td data-label="Data Aprovado">${/^\d{4}-\d{2}-\d{2}$/.test(item.data_aprovado)
                    ? item.data_aprovado.split('-').reverse().join('/')
                    : new Date(item.data_aprovado).toLocaleDateString('pt-BR')
                }</td>
        <td data-label="Ações">
            <button class="btn btn-baixar" title="Ver e baixar arquivos"
              onclick="verArquivos(${item.id}, '${(item.titulo || '').replace(/'/g, "\\'")}')">📂 Arquivos</button>
              
            ${isProt ? '' : `<button class="btn btn-protocolar" onclick="marcarProtocolado(${item.id})" title="Marcar como protocolado">✅ Protocolar</button>`}

            <button class="btn btn-devolver" onclick="devolverAcao(${item.id})" title="Devolver ação">↩️ Devolver</button>
        </td>
      `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Erro ao carregar dados:', err);
        tbody.innerHTML = '<tr><td colspan="7">Erro ao carregar dados</td></tr>';
    }
}

async function marcarProtocolado(id) {
    const ok = confirm("Confirma que já protocolou este processo no Projudi (ou outro sistema)?");
    if (!ok) return;
    try {
        const res = await fetchTenant(`/api/protocolacao/${id}/protocolar`, { method: 'PUT' });
        if (res.ok) {
            alert("✅ Protocolado com sucesso!");
            carregarProtocolacao();
        } else {
            const txt = await res.text().catch(() => '');
            alert("⚠️ Erro ao atualizar. " + (txt || "Tente novamente."));
        }
    } catch (err) {
        console.error(err);
        alert("❌ Erro de conexão com o servidor.");
    }
}

async function devolverAcao(id) {
    const ok = confirm("⚠️ Deseja realmente devolver esta ação? Ela sairá da lista de aprovadas.");
    if (!ok) return;

    try {
        // chamada ao backend para limpar 'data_aprovado'
        const res = await fetchTenant(`/api/protocolacao/${id}/devolver`, { method: 'DELETE' });
        if (res.ok) {
            alert("↩️ Ação devolvida com sucesso!");
            carregarProtocolacao(); // recarrega a tabela
        } else {
            const txt = await res.text().catch(() => '');
            alert("⚠️ Erro ao devolver. " + (txt || "Tente novamente."));
        }
    } catch (err) {
        console.error(err);
        alert("❌ Erro de conexão com o servidor.");
    }
}

// ----- Modal -----
function abrirModalDocumentos(titulo) {
    document.getElementById('modalDocsTitulo').textContent = titulo || 'Documentos da Ação';
    document.getElementById('modalDocumentos').classList.add('show');
}
function fecharModalDocumentos() {
    document.getElementById('modalDocumentos').classList.remove('show');
    document.getElementById('modalDocsLista').innerHTML = '';
}

async function verArquivos(acaoId, titulo) {
    const lista = document.getElementById('modalDocsLista');
    lista.innerHTML = '<div class="modal-docs-empty">Carregando arquivos...</div>';
    abrirModalDocumentos(`Documentos da Ação #${acaoId} — ${titulo}`);

    try {
        const res = await fetchTenant(`/api/protocolacao/${acaoId}/arquivos`);
        const arquivos = await res.json();

        if (!arquivos || !arquivos.length) {
            lista.innerHTML = '<div class="modal-docs-empty">Nenhum arquivo encontrado nesta ação.</div>';
            return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'modal-docs-arquivos';

        arquivos.forEach(a => {
            const card = document.createElement('div');
            card.className = 'modal-docs-arquivo-card';
            card.innerHTML = `
            <span class="modal-docs-arquivo-icon">📄</span>
            <span class="modal-docs-arquivo-nome" title="${a.nome}">${a.nome}</span>
            <a class="modal-docs-arquivo-link" href="${a.url}" target="_blank" rel="noopener" title="Baixar">⬇️ Baixar</a>
          `;
            wrap.appendChild(card);
        });

        lista.innerHTML = '';
        lista.appendChild(wrap);
    } catch (e) {
        console.error(e);
        lista.innerHTML = '<div class="modal-docs-empty">Erro ao carregar os arquivos.</div>';
    }
}

// ----- Filtros -----
document.getElementById('btnFiltrar').addEventListener('click', () => {
    filtro.dataAprovado = document.getElementById('filtroData').value || '';
    filtro.protocolado = document.getElementById('filtroProt').value;
    carregarProtocolacao();
});

document.getElementById('btnLimpar').addEventListener('click', () => {
    document.getElementById('filtroData').value = '';
    document.getElementById('filtroProt').value = 'nao';
    filtro.dataAprovado = '';
    filtro.protocolado = 'nao';
    carregarProtocolacao();
});

document.getElementById('filtroProt').addEventListener('change', e => {
    filtro.protocolado = e.target.value;
    carregarProtocolacao();
});

// ----- Inicializa -----
document.addEventListener('DOMContentLoaded', () => {
    carregarProtocolacao();
});
