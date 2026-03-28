// ============================================================
// FlexPOS — Sidebar Module
// Toggle, active link highlighting, mobile overlay, clock
// ============================================================

export function initSidebar() {
  const sidebar    = document.querySelector('.sidebar');
  const wrapper    = document.querySelector('.main-wrapper');
  const toggleBtn  = document.querySelector('.sidebar-toggle');
  const overlay    = document.querySelector('.sidebar-overlay');

  if (!sidebar) return;

  // ── Restore collapsed state ──
  const isCollapsed = localStorage.getItem('fp_sidebar_collapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
    wrapper?.classList.add('collapsed');
  }

  // ── Toggle handler ──
  function toggle() {
    sidebar.classList.toggle('collapsed');
    wrapper?.classList.toggle('collapsed');
    const now = sidebar.classList.contains('collapsed');
    localStorage.setItem('fp_sidebar_collapsed', now);
  }

  toggleBtn?.addEventListener('click', toggle);

  // ── Mobile overlay ──
  const mobileToggle = document.querySelector('.mobile-menu-btn');
  mobileToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
  });

  // ── Active link ──
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href && current.includes(href.replace('./', '').replace('/', ''))) {
      link.classList.add('active');
    }
  });

  // ── Logout button ──
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { logout } = await import('./auth.js');
      await logout();
    });
  }
}

// ── Topbar Clock ──
export function startClock(elementId = 'topbar-clock') {
  const el = document.getElementById(elementId);
  if (!el) return;

  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  return setInterval(tick, 1000);
}

// ── Topbar Date ──
export function setTopbarDate(elementId = 'topbar-date') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = new Date().toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}
