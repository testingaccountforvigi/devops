/* ============================================================
   api.js  —  Central API communication layer
   All fetch calls go through here.
   ============================================================ */

/*
 * API_BASE uses a relative path so it works in both environments:
 *   Local dev  → backend runs on same origin (localhost:3000), /api routes work directly
 *   Docker     → nginx reverse-proxies /api/* to the backend container internally
 */
const API_BASE = '/api';

/* ── Token helpers ── */
const Auth = {
  getToken  : ()        => localStorage.getItem('token'),
  getUser   : ()        => JSON.parse(localStorage.getItem('user') || 'null'),
  setSession: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  isLoggedIn : () => !!localStorage.getItem('token'),
  isAdmin    : () => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user && user.role === 'admin';
  },

  /* Call on every protected page to guard access */
  requireAuth: (redirectTo = 'login.html') => {
    if (!Auth.isLoggedIn()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  },
  requireAdmin: () => {
    if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  },
  logout: () => {
    Auth.clearSession();
    window.location.href = 'login.html';
  }
};

/* ── Core request function ── */
async function request(method, endpoint, body = null, requiresAuth = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (requiresAuth) {
    const token = Auth.getToken();
    if (!token) { Auth.logout(); return; }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  // Token expired
  if (response.status === 401 || response.status === 403) {
    Auth.clearSession();
    window.location.href = 'login.html';
    return;
  }

  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, message: data.message || 'Request failed', ...data };
  }
  return data;
}

/* ── API namespace ── */
const api = {
  get : (ep, auth = true)         => request('GET',    ep, null, auth),
  post: (ep, body, auth = false)  => request('POST',   ep, body, auth),
  put : (ep, body, auth = true)   => request('PUT',    ep, body, auth),
  del : (ep, auth = true)         => request('DELETE', ep, null, auth),

  /* Auth */
  auth: {
    login    : (data) => api.post('/auth/login',    data, false),
    register : (data) => api.post('/auth/register', data, false),
    profile  : ()     => api.get ('/auth/profile',  true),
  },

  /* Loans */
  loans: {
    apply       : (data) => api.post('/loans/apply',       data, true),
    myLoans     : ()     => api.get ('/loans/my-loans',    true),
    all         : ()     => api.get ('/loans/all',         true),
    stats       : ()     => api.get ('/loans/stats',       true),
    users       : ()     => api.get ('/loans/users',       true),
    updateStatus: (id, status) => api.put(`/loans/${id}/status`, { status }, true),
  }
};

/* ── Toast notification helper ── */
const Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3500) {
    this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error  : (msg) => Toast.show(msg, 'error'),
  info   : (msg) => Toast.show(msg, 'info'),
  warning: (msg) => Toast.show(msg, 'warning'),
};

/* ── Formatting helpers ── */
const Fmt = {
  currency: (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n),
  date    : (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  dateTime: (d) => new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  initials: (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?',
  capitalize: (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '',
  badge: (status) => `<span class="badge badge-${status}">${Fmt.capitalize(status)}</span>`,
  loanTypeIcon: (type) => ({ personal:'👤', home:'🏠', auto:'🚗', business:'💼', education:'🎓' }[type] || '💰'),
  creditRating: (score) => {
    if (score >= 800) return { label: 'Exceptional', color: '#10b981' };
    if (score >= 740) return { label: 'Very Good',   color: '#3b82f6' };
    if (score >= 670) return { label: 'Good',        color: '#60a5fa' };
    if (score >= 580) return { label: 'Fair',        color: '#f59e0b' };
    return               { label: 'Poor',        color: '#ef4444' };
  }
};

/* ── Sidebar injector (shared across all app pages) ── */
function initSidebar(activePage) {
  const user = Auth.getUser();
  if (!user) return;

  const isAdmin = user.role === 'admin';

  const userNavLinks = `
    <a href="dashboard.html"  class="nav-item ${activePage==='dashboard'  ? 'active':''}">
      <span class="nav-icon">🏠</span> Dashboard
    </a>
    <a href="apply-loan.html" class="nav-item ${activePage==='apply-loan' ? 'active':''}">
      <span class="nav-icon">📝</span> Apply for Loan
    </a>
    <a href="loans.html"      class="nav-item ${activePage==='loans'      ? 'active':''}">
      <span class="nav-icon">📋</span> My Loans
    </a>`;

  const adminNavLinks = `
    <div class="nav-section-label">Admin</div>
    <a href="admin-dashboard.html"  class="nav-item ${activePage==='admin-dashboard'  ? 'active':''}">
      <span class="nav-icon">📊</span> Admin Dashboard
    </a>
    <a href="loan-management.html"  class="nav-item ${activePage==='loan-management'  ? 'active':''}">
      <span class="nav-icon">⚙️</span> Loan Management
    </a>`;

  const sidebarHTML = `
    <div class="sidebar-brand">
      <div class="brand-icon">💰</div>
      <div>
        <div class="brand-name">LoanPro</div>
        <div class="brand-tagline">Origination System</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">Main Menu</div>
      ${userNavLinks}
      ${isAdmin ? adminNavLinks : ''}
    </nav>
    <div class="sidebar-footer">
      <div class="user-pill">
        <div class="user-avatar">${Fmt.initials(user.full_name)}</div>
        <div>
          <div class="user-info-name">${user.full_name}</div>
          <div class="user-info-role">${user.role}</div>
        </div>
        <button class="logout-btn" onclick="Auth.logout()" title="Logout">⏻</button>
      </div>
    </div>`;

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.innerHTML = sidebarHTML;

  /* Mobile hamburger toggle */
  const hamburger = document.getElementById('hamburger');
  const overlay   = document.getElementById('sidebar-overlay');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  /* Topbar user info */
  const tbUser = document.getElementById('tb-user-name');
  if (tbUser) tbUser.textContent = user.full_name;
}
