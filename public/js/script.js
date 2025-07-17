/* ========================================
   THEMIS DATA - FUNÇÕES COMPARTILHADAS
   ======================================== */

// Busca o nome do usuário logado ao carregar a página lendo o cookie diretamente
document.addEventListener('DOMContentLoaded', function () {
  function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
    return null;
  }

  const nomeUsuario = getCookie('usuario_nome');
  const usuarioId = getCookie('usuario_id');
  console.log(nomeUsuario, usuarioId);


  if (!nomeUsuario) {
    window.location.href = '/login.html';
  } else {
    document.getElementById('userNome').textContent = nomeUsuario;

    // Carrega a imagem do avatar do usuário
    const avatarImg = document.getElementById('userAvatar');
    const avatarFallback = document.getElementById('userAvatarFallback');

    if (avatarImg) {
      avatarImg.src = `/uploads/usuarios/usuario${usuarioId}.png`;
      avatarImg.onload = function () {
        avatarFallback.style.display = 'none';
      };
      avatarImg.onerror = function () {
        avatarImg.style.display = 'none';
        avatarFallback.style.display = 'flex';
        avatarFallback.textContent = nomeUsuario.charAt(0).toUpperCase();
      };
    }
  }
});

function toggleMenu() {
  const menu = document.getElementById('dropdownMenu');
  const toggle = document.querySelector('.menu-toggle');

  menu.classList.toggle('active');
  toggle.classList.toggle('active');
}

// Fechar menu quando clicar fora dele
document.addEventListener('click', function (event) {
  const menu = document.getElementById('dropdownMenu');
  const toggle = document.querySelector('.menu-toggle');

  if (!toggle.contains(event.target) && !menu.contains(event.target)) {
    menu.classList.remove('active');
    toggle.classList.remove('active');
  }
});

function logout() {
  if (confirm('Tem certeza que deseja sair?')) {
    window.location.href = '/login.html';
  }
}

function editarPerfil() {
  alert('Funcionalidade de editar perfil será implementada em breve!');
  toggleMenu();
}

function alterarSenha() {
  alert('Funcionalidade de alterar senha será implementada em breve!');
  toggleMenu();
}

function configuracoes() {
  alert('Funcionalidade de configurações será implementada em breve!');
  toggleMenu();
}

function ajuda() {
  alert('Funcionalidade de ajuda será implementada em breve!');
  toggleMenu();
}

// Após carregar o nome do usuário, buscar e exibir o nível de acesso
async function carregarUsuarioLogado() {
  try {
    const resposta = await fetch('/api/usuario-logado');
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
  } catch (e) { }
}
carregarUsuarioLogado();