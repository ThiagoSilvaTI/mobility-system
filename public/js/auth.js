const TOKEN_KEY = 'mobicidade_token';
const USER_KEY = 'mobicidade_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUsuario() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function salvarSessao(token, cidadao) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(cidadao));
}

function limparSessao() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function authFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  if (res.status === 401) {
    limparSessao();
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = '/login.html';
    }
    throw new Error('Não autenticado');
  }
  return res;
}

async function validarSessao() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    salvarSessao(token, data.cidadao);
    return data.cidadao;
  } catch {
    return null;
  }
}

async function logout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignora */
  }
  limparSessao();
  window.location.href = '/login.html';
}

function exigirLogin() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

function mascararCpf(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function renderLinkAdmin() {
  const nav = document.querySelector('.header__nav');
  if (!nav) return;
  let link = document.getElementById('navLinkAdmin');
  const u = getUsuario();

  if (u?.isAdmin) {
    if (!link) {
      link = document.createElement('a');
      link.id = 'navLinkAdmin';
      link.href = '/admin.html';
      link.className = 'nav-link-admin';
      link.textContent = 'Admin';
      link.title = 'Painel administrativo';
      link.setAttribute('aria-label', 'Abrir painel administrativo');
      nav.appendChild(link);
    }
    link.hidden = false;
  } else if (link) {
    link.remove();
  }
}

function renderUsuarioHeader() {
  const el = document.getElementById('userBar');
  const u = getUsuario();
  if (!el || !u) return;
  el.innerHTML = `
    <span class="user-bar__nome" title="CPF ${u.cpf}">Olá, <strong>${u.nome.split(' ')[0]}</strong></span>
    ${u.isAdmin ? '<span class="user-bar__badge" title="Administrador">Gestor</span>' : ''}
    <button type="button" class="btn btn--sm btn--outline" id="btnLogout">Sair</button>
  `;
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  renderLinkAdmin();
}
