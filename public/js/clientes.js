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

    // Carregar dados se for a aba de lista
    if (tabName === 'lista') {
        carregarClientes();
    }
}

// Funções do formulário
function limparFormulario() {
    document.getElementById('clienteForm').reset();
    hideMessage();
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    setTimeout(() => {
        hideMessage();
    }, 5000);
}

function hideMessage() {
    document.getElementById('message').style.display = 'none';
}

// Cadastro de cliente
document.getElementById('clienteForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const clienteData = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/clientes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clienteData)
        });

        const result = await response.json();

        if (result.sucesso) {
            showMessage('Cliente cadastrado com sucesso!', 'success');
            limparFormulario();
        } else {
            showMessage(result.mensagem || 'Erro ao cadastrar cliente', 'error');
        }
    } catch (error) {
        showMessage('Erro ao conectar com o servidor', 'error');
    }
});

let clientesCache = [];

// Carregar lista de clientes
async function carregarClientes() {
    try {
        const response = await fetch('/api/clientes');
        const clientes = await response.json();
        const tbody = document.getElementById('clientesTableBody');
        tbody.innerHTML = '';
        clientes.forEach(cliente => {
            const row = document.createElement('tr');
            row.innerHTML = `
            <td>${cliente.nome}</td>
            <td>${cliente.cpf_cnpj}</td>
            <td>${cliente.telefone1 || '-'}</td>
            <td>
            <div class="action-buttons">
            <button class="btn btn-secondary btn-sm" onclick="visualizarCliente(${cliente.id})">
            <i class="fa fa-eye"></i>
            </button>
            <button class="btn btn-warning btn-sm" onclick="editarCliente(${cliente.id})">
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

// Busca no servidor
async function buscarClientes(searchTerm = "") {
    try {
        const resp = await fetch(`/api/clientes?searchTerm=${encodeURIComponent(searchTerm)}`);
        const clientes = await resp.json();

        const tbody = document.getElementById('clientesTableBody');
        tbody.innerHTML = '';

        clientes.forEach(cliente => {
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

        clientesCache = clientes; // atualiza cache para edição
    } catch (e) {
        console.error('Erro ao buscar clientes:', e);
        showMessage('Erro ao buscar clientes', 'error');
    }
}


function editarCliente(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if (!cliente) return;
    document.getElementById('edit_id').value = cliente.id || '';
    document.getElementById('edit_nome').value = cliente.nome || '';
    if (cliente.data_nasc) {
        document.getElementById('edit_data_nasc').value = cliente.data_nasc.substring(0, 10);
    } else {
        document.getElementById('edit_data_nasc').value = '';
    }
    document.getElementById('edit_cpf_cnpj').value = cliente.cpf_cnpj || '';
    document.getElementById('edit_rg').value = cliente.rg || '';
    document.getElementById('edit_telefone1').value = cliente.telefone1 || '';
    document.getElementById('edit_telefone2').value = cliente.telefone2 || '';
    document.getElementById('edit_email').value = cliente.email || '';
    document.getElementById('edit_endereco').value = cliente.endereco || '';
    document.getElementById('edit_bairro').value = cliente.bairro || '';
    document.getElementById('edit_cep').value = cliente.cep || '';
    document.getElementById('edit_uf').value = cliente.uf || '';
    document.getElementById('edit_cidade').value = cliente.cidade || '';
    document.getElementById('edit_profissao').value = cliente.profissao || '';
    document.getElementById('edit_nacionalidade').value = cliente.nacionalidade || '';
    document.getElementById('edit_estado_civil').value = cliente.estado_civil || '';
    document.getElementById('modalEditarCliente').style.display = 'block';
}

function fecharModalEditar() {
    document.getElementById('modalEditarCliente').style.display = 'none';
}

function visualizarCliente(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if (!cliente) return;

    // Preenche os campos (todos só-leitura no HTML)
    document.getElementById('view_id').value = cliente.id || '';
    document.getElementById('view_nome').value = cliente.nome || '';
    if (cliente.data_nasc) {
        document.getElementById('view_data_nasc').value = (cliente.data_nasc || '').substring(0, 10);
    } else {
        document.getElementById('view_data_nasc').value = '';
    }
    document.getElementById('view_cpf_cnpj').value = cliente.cpf_cnpj || '';
    document.getElementById('view_rg').value = cliente.rg || '';
    document.getElementById('view_telefone1').value = cliente.telefone1 || '';
    document.getElementById('view_telefone2').value = cliente.telefone2 || '';
    document.getElementById('view_email').value = cliente.email || '';
    document.getElementById('view_endereco').value = cliente.endereco || '';
    document.getElementById('view_bairro').value = cliente.bairro || '';
    document.getElementById('view_cep').value = cliente.cep || '';
    document.getElementById('view_uf').value = cliente.uf || '';
    document.getElementById('view_cidade').value = cliente.cidade || '';
    document.getElementById('view_profissao').value = cliente.profissao || '';
    document.getElementById('view_nacionalidade').value = cliente.nacionalidade || '';
    document.getElementById('view_estado_civil').value = cliente.estado_civil || '';

    document.getElementById('modalVisualizarCliente').style.display = 'block';
}

function fecharModalVisualizar() {
    document.getElementById('modalVisualizarCliente').style.display = 'none';
}


function excluirCliente(id) {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
        fetch(`/api/clientes/${id}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(result => {
                if (result.sucesso) {
                    showMessage('Cliente excluído com sucesso!', 'success');
                    fecharModalEditar();
                    carregarClientes();
                } else {
                    showMessage(result.mensagem || 'Erro ao excluir cliente', 'error');
                }
            })
            .catch(() => {
                showMessage('Erro ao conectar com o servidor', 'error');
            });
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function () {
    console.log('Página de clientes carregada!');
    document.getElementById('formEditarCliente').addEventListener('submit', async function (e) {
        e.preventDefault();
        const formData = new FormData(this);
        const clienteData = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(`/api/clientes/${clienteData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clienteData)
            });
            const result = await response.json();
            if (result.sucesso) {
                showMessage('Cliente atualizado com sucesso!', 'success');
                fecharModalEditar();
                carregarClientes();
            } else {
                showMessage(result.mensagem || 'Erro ao atualizar cliente', 'error');
            }
        } catch (error) {
            showMessage('Erro ao conectar com o servidor', 'error');
        }
    });

    // Aplica máscara ao digitar nos campos de CPF/CNPJ
    const cpfCnpjInput = document.getElementById('cpf_cnpj');
    if (cpfCnpjInput) {
        cpfCnpjInput.addEventListener('input', function (e) {
            const cursor = cpfCnpjInput.selectionStart;
            const oldValue = cpfCnpjInput.value;
            cpfCnpjInput.value = maskCpfCnpj(cpfCnpjInput.value);
            // Ajusta o cursor para o final
            cpfCnpjInput.setSelectionRange(cpfCnpjInput.value.length, cpfCnpjInput.value.length);
        });
    }

    // Para o modal de edição
    const editCpfCnpjInput = document.getElementById('edit_cpf_cnpj');
    if (editCpfCnpjInput) {
        editCpfCnpjInput.addEventListener('input', function (e) {
            editCpfCnpjInput.value = maskCpfCnpj(editCpfCnpjInput.value);
            editCpfCnpjInput.setSelectionRange(editCpfCnpjInput.value.length, editCpfCnpjInput.value.length);
        });
    }

    // Máscara automática para CPF/CNPJ
    function maskCpfCnpj(value) {
        value = value.replace(/\D/g, '');
        if (value.length <= 11) {
            // CPF: 000.000.000-00
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            // CNPJ: 00.000.000/0000-00
            value = value.replace(/(\d{2})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1/$2');
            value = value.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        return value;
    }

    // Função para capitalizar cada palavra
    function capitalizeWords(str) {
        return str.replace(/\b\w+/g, function (word) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        });
    }

    // Função para forçar minúsculas
    function toLower(str) {
        return str.toLowerCase();
    }

    // Intercepta o submit do formulário para ajustar os campos
    const clienteForm = document.getElementById('clienteForm');
    if (clienteForm) {
        clienteForm.addEventListener('submit', function (e) {
            // Antes de enviar, ajusta os valores dos campos
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
        }, true);
    }

    // Para o modal de edição
    const formEditarCliente = document.getElementById('formEditarCliente');
    if (formEditarCliente) {
        formEditarCliente.addEventListener('submit', function (e) {
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
        }, true);
    }

    // Aplica máscara ao digitar nos campos de telefone
    const telefoneInput = document.getElementById('telefone1') || document.getElementById('telefone2');
    if (telefoneInput) {
        telefoneInput.addEventListener('input', function (e) {
            telefoneInput.value = maskTelefone(telefoneInput.value);
            telefoneInput.setSelectionRange(telefoneInput.value.length, telefoneInput.value.length);
        });
    }

    // Para o modal de edição de telefone
    const editTelefoneInput = document.getElementById('edit_telefone1') || document.getElementById('edit_telefone2');
    if (editTelefoneInput) {
        editTelefoneInput.addEventListener('input', function (e) {
            editTelefoneInput.value = maskTelefone(editTelefoneInput.value);
            editTelefoneInput.setSelectionRange(editTelefoneInput.value.length, editTelefoneInput.value.length);
        });
    }

    // Máscara automática para telefone
    function maskTelefone(value) {
        value = value.replace(/\D/g, '');
        if (value.length <= 11) {
            // Formato: (XX)XXXXX-XXXX
            value = value.replace(/(\d{2})(\d)/, '($1)$2');
            value = value.replace(/(\d{5})(\d)/, '$1-$2');
        }
        return value;
    }

});
