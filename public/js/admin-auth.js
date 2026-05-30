const ADMIN_TOKEN_KEY = 'mobicidade_admin_token';
const ADMIN_USER_KEY = 'mobicidade_admin_user';

function getAdminToken() {
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (adminToken) return adminToken;
  if (typeof getUsuario === 'function' && typeof getToken === 'function') {
    const u = getUsuario();
    if (u?.isAdmin) return getToken();
  }
  return null;
}

function getAdminUsuario() {
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function salvarSessaoAdmin(token, admin) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(admin));
}

function limparSessaoAdmin() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

function adminHeaders(extra = {}) {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: adminHeaders(options.headers || {}),
  });
  if (res.status === 401 || res.status === 403) {
    limparSessaoAdmin();
    if (!window.location.pathname.includes('/admin/login')) {
      window.location.href = '/admin/login.html';
    }
    throw new Error('Sem permissão administrativa');
  }
  return res;
}

async function validarSessaoAdmin() {
  const token = getAdminToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    salvarSessaoAdmin(token, data.admin);
    return data.admin;
  } catch {
    return null;
  }
}

async function logoutAdmin() {
  try {
    await adminFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignora */
  }
  limparSessaoAdmin();
  window.location.href = '/admin/login.html';
}

function exigirAdmin() {
  if (!getAdminToken()) {
    window.location.href = '/admin/login.html';
    return false;
  }
  return true;
}
