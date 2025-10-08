/**
 * public/js/clientes.js
 * ----------------------------------------
 * Frontend de Clientes (SaaS multi-tenant).
 * - Envia sempre o cabeçalho `x-tenant-id` (obtido do cookie `tenant_id`)
 * - CRUD + busca com debounce
 * - Máscaras de CPF/CNPJ e telefone
 * - Modais de visualizar/editar
 */

/* ===================== Utils (tenant/cookies) ===================== */
function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
}
function getTenantHeaders() {
    const t = getCookie('tenant_id');
    const headers = { 'x-tenant-id': t || '' };
    return headers;
}

/* ===================== Navegação entre abas ===================== */
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const el = document.getElementById(tabName);
    if (el) el.classList.add('active');

    if (typeof event !== 'undefined' && event?.target) {
        event.target.classList.add('active');
    }

    if (tabName === 'lista') {
        carregarClientes();
    }
}

/* ===================== Helpers de UI ===================== */
function limparFormulario() {
    const form = document.getElementById('clienteForm');
    if (form) form.reset();
    hideMessage();
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(hideMessage, 5000);
}

function hideMessage() {
    const messageDiv = document.getElementById('message');
    if (messageDiv) messageDiv.style.display = 'none';
}

/* ===================== Cadastro de cliente ===================== */
document.getElementById('clienteForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const clienteData = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/clientes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getTenantHeaders(),
            },
            credentials: 'same-origin',
            body: JSON.stringify(clienteData),
        });

        const result = await response.json();
        if (result.sucesso) {
            showMessage('Cliente cadastrado com sucesso!', 'success');
            limparFormulario();
            carregarClientes();
            showTab('lista');
        } else {
            showMessage(result.mensagem || 'Erro ao cadastrar cliente', 'error');
        }
    } catch (_e) {
        showMessage('Erro ao conectar com o servidor', 'error');
    }
});

let clientesCache = [];

/* ===================== Carregar lista ===================== */
async function carregarClientes() {
    try {
        const response = await fetch('/api/clientes', {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        });
        const clientes = await response.json();

        const tbody = document.getElementById('clientesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        clientes.forEach((cliente) => {
            const row = document.createElement('tr');
            row.innerHTML = `
        <td>${cliente.nome}</td>
        <td>${cliente.cpf_cnpj}</td>
        <td>${cliente.telefone1 || '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-secondary btn-sm" onclick="visualizarCliente(${cliente.id})" title="Visualizar">
              <i class="fa fa-eye"></i>
            </button>
            <button class="btn btn-warning btn-sm" onclick="editarCliente(${cliente.id})" title="Editar">
              <i class="fa fa-pencil-alt"></i>
            </button>
          </div>
        </td>
      `;
            tbody.appendChild(row);
        });

        clientesCache = clientes;
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        showMessage('Erro ao carregar clientes', 'error');
    }
}

let debounceTimer;
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('searchInput');
    if (input) {
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                buscarClientes(input.value.trim());
            }, 300);
        });
    }
});

/* ===================== Busca ===================== */
async function buscarClientes(searchTerm = '') {
    try {
        const resp = await fetch(`/api/clientes?searchTerm=${encodeURIComponent(searchTerm)}`, {
            headers: { ...getTenantHeaders() },
            credentials: 'same-origin',
        });
        const clientes = await resp.json();

        const tbody = document.getElementById('clientesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        clientes.forEach((cliente) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${cliente.nome}</td>
        <td>${cliente.cpf_cnpj}</td>
        <td>${cliente.telefone1 || '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-secondary btn-sm" onclick="visualizarCliente(${cliente.id})">Visualizar</button>
            <button class="btn btn-warning btn-sm" onclick="editarCliente(${cliente.id})">Editar</button>
          </div>
        </td>
      `;
            tbody.appendChild(tr);
        });

        clientesCache = clientes;
    } catch (e) {
        console.error('Erro ao buscar clientes:', e);
        showMessage('Erro ao buscar clientes', 'error');
    }
}

/* ===================== Modais: editar/visualizar ===================== */
function editarCliente(id) {
    const c = clientesCache.find((x) => x.id === id);
    if (!c) return;

    document.getElementById('edit_id').value = c.id || '';
    document.getElementById('edit_nome').value = c.nome || '';
    document.getElementById('edit_data_nasc').value = c.data_nasc ? String(c.data_nasc).substring(0, 10) : '';
    document.getElementById('edit_cpf_cnpj').value = c.cpf_cnpj || '';
    document.getElementById('edit_rg').value = c.rg || '';
    document.getElementById('edit_telefone1').value = c.telefone1 || '';
    document.getElementById('edit_telefone2').value = c.telefone2 || '';
    document.getElementById('edit_email').value = c.email || '';
    document.getElementById('edit_endereco').value = c.endereco || '';
    document.getElementById('edit_bairro').value = c.bairro || '';
    document.getElementById('edit_cep').value = c.cep || '';
    document.getElementById('edit_uf').value = c.uf || '';
    document.getElementById('edit_cidade').value = c.cidade || '';
    document.getElementById('edit_profissao').value = c.profissao || '';
    document.getElementById('edit_nacionalidade').value = c.nacionalidade || '';
    document.getElementById('edit_estado_civil').value = c.estado_civil || '';

    document.getElementById('modalEditarCliente').style.display = 'block';
}

function fecharModalEditar() {
    document.getElementById('modalEditarCliente').style.display = 'none';
}

function visualizarCliente(id) {
    const c = clientesCache.find((x) => x.id === id);
    if (!c) return;

    document.getElementById('view_id').value = c.id || '';
    document.getElementById('view_nome').value = c.nome || '';
    document.getElementById('view_data_nasc').value = c.data_nasc ? String(c.data_nasc).substring(0, 10) : '';
    document.getElementById('view_cpf_cnpj').value = c.cpf_cnpj || '';
    document.getElementById('view_rg').value = c.rg || '';
    document.getElementById('view_telefone1').value = c.telefone1 || '';
    document.getElementById('view_telefone2').value = c.telefone2 || '';
    document.getElementById('view_email').value = c.email || '';
    document.getElementById('view_endereco').value = c.endereco || '';
    document.getElementById('view_bairro').value = c.bairro || '';
    document.getElementById('view_cep').value = c.cep || '';
    document.getElementById('view_uf').value = c.uf || '';
    document.getElementById('view_cidade').value = c.cidade || '';
    document.getElementById('view_profissao').value = c.profissao || '';
    document.getElementById('view_nacionalidade').value = c.nacionalidade || '';
    document.getElementById('view_estado_civil').value = c.estado_civil || '';

    document.getElementById('modalVisualizarCliente').style.display = 'block';
}

function fecharModalVisualizar() {
    document.getElementById('modalVisualizarCliente').style.display = 'none';
}

/* ===================== Excluir ===================== */
function excluirCliente(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    fetch(`/api/clientes/${id}`, {
        method: 'DELETE',
        headers: { ...getTenantHeaders() },
        credentials: 'same-origin',
    })
        .then((r) => r.json())
        .then((result) => {
            if (result.sucesso) {
                showMessage('Cliente excluído com sucesso!', 'success');
                fecharModalEditar();
                carregarClientes();
            } else {
                showMessage(result.mensagem || 'Erro ao excluir cliente', 'error');
            }
        })
        .catch(() => showMessage('Erro ao conectar com o servidor', 'error'));
}

/* ===================== Inicialização / Eventos ===================== */
document.addEventListener('DOMContentLoaded', function () {
    console.log('Página de clientes carregada!');

    // Submit do modal de edição
    document.getElementById('formEditarCliente')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const formData = new FormData(this);
        const clienteData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`/api/clientes/${clienteData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getTenantHeaders(),
                },
                credentials: 'same-origin',
                body: JSON.stringify(clienteData),
            });
            const result = await response.json();
            if (result.sucesso) {
                showMessage('Cliente atualizado com sucesso!', 'success');
                fecharModalEditar();
                carregarClientes();
            } else {
                showMessage(result.mensagem || 'Erro ao atualizar cliente', 'error');
            }
        } catch (_e) {
            showMessage('Erro ao conectar com o servidor', 'error');
        }
    });

    // Máscara CPF/CNPJ (cadastro)
    const cpfCnpjInput = document.getElementById('cpf_cnpj');
    cpfCnpjInput?.addEventListener('input', function () {
        const pos = cpfCnpjInput.selectionStart;
        cpfCnpjInput.value = maskCpfCnpj(cpfCnpjInput.value);
        cpfCnpjInput.setSelectionRange(cpfCnpjInput.value.length, cpfCnpjInput.value.length);
    });

    // Máscara CPF/CNPJ (edição)
    const editCpfCnpjInput = document.getElementById('edit_cpf_cnpj');
    editCpfCnpjInput?.addEventListener('input', function () {
        editCpfCnpjInput.value = maskCpfCnpj(editCpfCnpjInput.value);
        editCpfCnpjInput.setSelectionRange(editCpfCnpjInput.value.length, editCpfCnpjInput.value.length);
    });

    // Ajustes de capitalização/minúsculas antes do submit (cadastro)
    const clienteForm = document.getElementById('clienteForm');
    clienteForm?.addEventListener(
        'submit',
        function () {
            const nomeInput = document.getElementById('nome');
            const cidadeInput = document.getElementById('cidade');
            const profissaoInput = document.getElementById('profissao');
            const nacionalidadeInput = document.getElementById('nacionalidade');
            const estadoCivilInput = document.getElementById('estado_civil');

            if (nomeInput) nomeInput.value = capitalizeWords(nomeInput.value);
            if (cidadeInput) cidadeInput.value = capitalizeWords(cidadeInput.value);
            if (profissaoInput) profissaoInput.value = toLower(profissaoInput.value);
            if (nacionalidadeInput) nacionalidadeInput.value = toLower(nacionalidadeInput.value);
            if (estadoCivilInput) estadoCivilInput.value = toLower(estadoCivilInput.value);
        },
        true
    );

    // Ajustes no modal de edição
    const formEditarCliente = document.getElementById('formEditarCliente');
    formEditarCliente?.addEventListener(
        'submit',
        function () {
            const nomeInput = document.getElementById('edit_nome');
            const cidadeInput = document.getElementById('edit_cidade');
            const profissaoInput = document.getElementById('edit_profissao');
            const nacionalidadeInput = document.getElementById('edit_nacionalidade');
            const estadoCivilInput = document.getElementById('edit_estado_civil');

            if (nomeInput) nomeInput.value = capitalizeWords(nomeInput.value);
            if (cidadeInput) cidadeInput.value = capitalizeWords(cidadeInput.value);
            if (profissaoInput) profissaoInput.value = toLower(profissaoInput.value);
            if (nacionalidadeInput) nacionalidadeInput.value = toLower(nacionalidadeInput.value);
            if (estadoCivilInput) estadoCivilInput.value = toLower(estadoCivilInput.value);
        },
        true
    );

    // Máscaras telefone
    const telefoneInput = document.getElementById('telefone1') || document.getElementById('telefone2');
    telefoneInput?.addEventListener('input', function () {
        telefoneInput.value = maskTelefone(telefoneInput.value);
        telefoneInput.setSelectionRange(telefoneInput.value.length, telefoneInput.value.length);
    });

    const editTelefoneInput = document.getElementById('edit_telefone1') || document.getElementById('edit_telefone2');
    editTelefoneInput?.addEventListener('input', function () {
        editTelefoneInput.value = maskTelefone(editTelefoneInput.value);
        editTelefoneInput.setSelectionRange(editTelefoneInput.value.length, editTelefoneInput.value.length);
    });
});

/* ===================== Máscaras / format helpers ===================== */
function maskCpfCnpj(value) {
    value = String(value || '').replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        value = value.replace(/(\d{2})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1/$2');
        value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    return value;
}

function maskTelefone(value) {
    value = String(value || '').replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/(\d{2})(\d)/, '($1)$2');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
}

function capitalizeWords(str) {
    return String(str || '').replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
function toLower(str) {
    return String(str || '').toLowerCase();
}
