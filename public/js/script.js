/* ========================================
   THEMIS DATA - FUNÇÕES COMPARTILHADAS (MULTI-TENANT)
   ======================================== */

/* ====== MULTI-TENANT: configuração global ====== */
// evita conflito se outro arquivo também tiver essa constante
if (typeof window.THEMIS_TENANT_ID === 'undefined') {
  window.THEMIS_TENANT_ID = localStorage.getItem('tenant_id') || '1';
}

// função fetchTenant — só define se ainda não existir
if (typeof window.fetchTenant === 'undefined') {
  window.fetchTenant = function (url, options = {}) {
    const base = options || {};
    const headers = new Headers(base.headers || {});
    headers.set('X-Tenant-Id', window.THEMIS_TENANT_ID);
    return fetch(url, {
      credentials: 'same-origin',
      ...base,
      headers
    });
  };
}

/* ====== INICIALIZAÇÃO DE USUÁRIO E INTERFACE ====== */
document.addEventListener('DOMContentLoaded', function () {
  function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
    return null;
  }

  const nomeUsuario = getCookie('usuario_nome');
  const usuarioId = getCookie('usuario_id');
  console.log('[USER]', nomeUsuario, usuarioId, 'Tenant:', window.THEMIS_TENANT_ID);

  if (!nomeUsuario) {
    window.location.href = '/login.html';
  } else {
    const nomeEl = document.getElementById('userNome');
    if (nomeEl) nomeEl.textContent = nomeUsuario;

    const avatarImg = document.getElementById('userAvatar');
    const avatarFallback = document.getElementById('userAvatarFallback');

    if (avatarImg && avatarFallback) {
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

/* ====== MENU SUPERIOR ====== */
function toggleMenu() {
  const menu = document.getElementById('dropdownMenu');
  const toggle = document.querySelector('.menu-toggle');
  if (!menu || !toggle) return;
  menu.classList.toggle('active');
  toggle.classList.toggle('active');
}

// Fechar menu quando clicar fora dele
document.addEventListener('click', function (event) {
  const menu = document.getElementById('dropdownMenu');
  const toggle = document.querySelector('.menu-toggle');
  if (!menu || !toggle) return;

  if (!toggle.contains(event.target) && !menu.contains(event.target)) {
    menu.classList.remove('active');
    toggle.classList.remove('active');
  }
});

/* ====== AÇÕES DO MENU ====== */
function logout() {
  if (confirm('Tem certeza que deseja sair?')) {
    localStorage.removeItem('tenant_id');
    window.location.href = '/login.html';
  }
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

/* ====== BUSCAR DADOS DO USUÁRIO LOGADO ====== */
async function carregarUsuarioLogado() {
  try {
    const resposta = await window.fetchTenant('/api/usuario-logado');
    if (!resposta.ok) return;

    const usuario = await resposta.json();
    const nomeEl = document.getElementById('userNome');
    if (nomeEl) nomeEl.textContent = usuario.nome;

    let nivel = usuario.nivel_acesso;
    switch (nivel) {
      case 'admin': nivel = 'Administrador'; break;
      case 'adv': nivel = 'Advogado'; break;
      case 'gerente': nivel = 'Gerente'; break;
      case 'estagiario': nivel = 'Estagiário'; break;
      case 'secretaria': nivel = 'Secretária'; break;
    }
    const nivelEl = document.getElementById('userNivelAcesso');
    if (nivelEl) nivelEl.textContent = nivel;

    if (usuario.tenant_id) {
      localStorage.setItem('tenant_id', usuario.tenant_id);
      window.THEMIS_TENANT_ID = usuario.tenant_id;
    }
  } catch (e) {
    console.warn('[USER] Falha ao carregar usuário logado:', e);
  }
}

carregarUsuarioLogado();
