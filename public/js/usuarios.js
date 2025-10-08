/* ========================================================================
 * USUÁRIOS – Multi-Tenant
 *  - Envia X-Tenant-Id em todas as requisições
 *  - tenant_id vem do localStorage (definido no login) com fallback '1'
 * ===================================================================== */

/* ====== MULTI-TENANT: helper padrão ====== */
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

// Funções para abrir/fechar modal
function abrirModalUsuario(usuario = null) {
    document.getElementById('formUsuario').reset();
    document.getElementById('modalUsuarioTitulo').textContent = usuario ? 'Editar Usuário' : 'Novo Usuário';
    if (usuario) {
        document.getElementById('usuario_id').value = usuario.id;
        document.getElementById('usuario_nome').value = usuario.nome;
        document.getElementById('usuario_email').value = usuario.email;
        document.getElementById('usuario_nivel').value = usuario.nivel_acesso;
        document.getElementById('usuario_ativo').value = usuario.ativo;
        document.getElementById('usuario_senha').required = false;
    } else {
        document.getElementById('usuario_id').value = '';
        document.getElementById('usuario_senha').required = true;
    }
    document.getElementById('modalUsuario').style.display = 'block';
}
function fecharModalUsuario() {
    document.getElementById('modalUsuario').style.display = 'none';
}

// Função para carregar e exibir os usuários na tabela
async function carregarUsuarios() {
    try {
        const resposta = await fetchTenant('/api/usuarios');
        const usuarios = await resposta.json();

        // Atualiza o total de usuários
        document.getElementById('usuariosTotal').textContent = usuarios.length;

        // Monta as linhas da tabela
        const tbody = document.getElementById('usuariosTableBody');
        tbody.innerHTML = '';
        usuarios.forEach(usuario => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${usuario.id}</td>
        <td>${usuario.nome}</td>
        <td>${usuario.email}</td>
        <td>${usuario.nivel_acesso}</td>
        <td>${usuario.data_criacao ? new Date(usuario.data_criacao).toLocaleString('pt-BR') : ''}</td>
        <td>${usuario.ultimo_acesso ? new Date(usuario.ultimo_acesso).toLocaleString('pt-BR') : ''}</td>
        <td>${usuario.ativo == 1 ? 'Sim' : 'Não'}</td>
        <td class="action-buttons">
          <button class="btn btn-sm btn-primary" onclick='abrirModalUsuario(${JSON.stringify(usuario)})'>✏️</button>
        </td>
      `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        alert('Erro ao carregar usuários!');
        console.error(error);
    }
}

// Após carregar o nome do usuário, buscar e exibir o nível de acesso
async function carregarUsuarioLogado() {
    try {
        const resposta = await fetchTenant('/api/usuario-logado');
        if (!resposta.ok) return;
        const usuario = await resposta.json();
        document.getElementById('userNome').textContent = usuario.nome;
        let nivel = usuario.nivel_acesso;
        // Traduzir para português se necessário
        switch (nivel) {
            case 'admin': nivel = 'Administrador'; break;
            case 'adv': nivel = 'Advogado'; break;
            case 'gerente': nivel = 'Gerente'; break;
            case 'estagiario': nivel = 'Estagiário'; break;
            case 'secretaria': nivel = 'Secretária'; break;
        }
        document.getElementById('userNivelAcesso').textContent = nivel;

        // atualiza tenant local se o backend devolver
        if (usuario.tenant_id) localStorage.setItem('tenant_id', usuario.tenant_id);
    } catch (e) { }
}
carregarUsuarioLogado();

// Carregar usuários ao abrir a página
window.onload = carregarUsuarios;

// Intercepta o submit do formulário de usuário
document.getElementById('formUsuario').addEventListener('submit', async function (event) {
    event.preventDefault();

    const id = document.getElementById('usuario_id').value;
    const nome = document.getElementById('usuario_nome').value;
    const email = document.getElementById('usuario_email').value;
    const senha = document.getElementById('usuario_senha').value;
    const nivel_acesso = document.getElementById('usuario_nivel').value;
    const ativo = document.getElementById('usuario_ativo').value;

    let usuario = {};
    let url = '/api/usuarios';
    let method = 'POST';

    if (id) {
        // Edição: só envia campos preenchidos
        if (nome) usuario.nome = nome;
        if (email) usuario.email = email;
        if (senha) usuario.senha = senha;
        if (nivel_acesso) usuario.nivel_acesso = nivel_acesso;
        if (ativo) usuario.ativo = ativo;
        url += '/' + id;
        method = 'PUT';
    } else {
        // Cadastro: todos obrigatórios
        usuario = { nome, email, senha, nivel_acesso, ativo };
    }

    try {
        const resposta = await fetchTenant(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(usuario)
        });
        const resultado = await resposta.json();
        if (resposta.ok && resultado.sucesso) {
            alert(id ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!');
            fecharModalUsuario();
            carregarUsuarios();
        } else {
            alert(resultado.mensagem || 'Erro ao salvar usuário!');
        }
    } catch (error) {
        alert('Erro ao salvar usuário!');
        console.error(error);
    }
});
