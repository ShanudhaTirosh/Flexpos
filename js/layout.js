// ============================================================
// FlexPOS — Sidebar HTML Builder
// Injects sidebar and topbar markup into the page
// ============================================================

export function buildSidebar(activePage = '') {
  const nav = [
    {
      group: 'Main',
      items: [
        { page: 'dashboard', href: 'dashboard.html', icon: 'bi-grid-1x2-fill',      label: 'Dashboard',  roles: ['admin','manager'] },
        { page: 'pos',       href: 'pos.html',       icon: 'bi-cart3',               label: 'Point of Sale', roles: ['admin','manager','cashier'] },
      ]
    },
    {
      group: 'Catalog',
      items: [
        { page: 'products',  href: 'products.html',  icon: 'bi-box-seam',            label: 'Products',   roles: ['admin','manager'] },
        { page: 'inventory', href: 'inventory.html', icon: 'bi-clipboard2-data',     label: 'Inventory',  roles: ['admin','manager'] },
        { page: 'customers', href: 'customers.html', icon: 'bi-people',              label: 'Customers',  roles: ['admin','manager','cashier'] },
      ]
    },
    {
      group: 'Finance',
      items: [
        { page: 'orders',   href: 'orders.html',   icon: 'bi-receipt',              label: 'Orders',    roles: ['admin','manager','cashier'] },
        { page: 'expenses', href: 'expenses.html', icon: 'bi-cash-stack',           label: 'Expenses',  roles: ['admin','manager'] },
        { page: 'reports',  href: 'reports.html',  icon: 'bi-bar-chart-line',       label: 'Reports',   roles: ['admin','manager'] },
      ]
    },
    {
      group: 'System',
      items: [
        { page: 'settings', href: 'settings.html', icon: 'bi-gear',                 label: 'Settings',  roles: ['admin'] },
        { page: 'profile',  href: 'profile.html',  icon: 'bi-person-circle',        label: 'My Profile', roles: ['admin','manager','cashier'] },
      ]
    }
  ];

  return `
<aside class="sidebar" id="sidebar">
  <button class="sidebar-toggle" aria-label="Toggle sidebar">
    <i class="bi bi-chevron-left"></i>
  </button>

  <a href="dashboard.html" class="sidebar-logo">
    <div class="logo-mark"><i class="bi bi-lightning-charge-fill"></i></div>
    <span class="logo-text">Flex<span>POS</span></span>
  </a>

  <nav class="sidebar-nav">
    ${nav.map(group => `
      <div class="nav-group">
        <div class="nav-group-label">${group.group}</div>
        <ul class="list-unstyled mb-0">
          ${group.items.map(item => `
            <li class="nav-item" data-roles='${JSON.stringify(item.roles)}'>
              <a class="nav-link ${item.page === activePage ? 'active' : ''}"
                 href="${item.href}"
                 data-tooltip="${item.label}">
                <i class="bi ${item.icon} nav-icon"></i>
                <span class="nav-label">${item.label}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('')}
  </nav>

  <div class="sidebar-footer">
    <div class="sidebar-user" id="sidebar-user-btn">
      <div class="user-avatar" id="sidebar-user-avatar">U</div>
      <div class="user-info">
        <div class="user-name" id="sidebar-user-name">Loading…</div>
        <div class="user-role">
          <span class="role-badge role-cashier" id="sidebar-user-role">—</span>
        </div>
      </div>
    </div>
    <div class="d-flex gap-2 mt-2 px-1">
      <button class="btn btn-glass btn-sm flex-1 w-100" data-theme-toggle title="Toggle theme">
        <i class="bi bi-sun-fill"></i>
        <span class="nav-label ms-1" data-theme-label>Light</span>
      </button>
      <button class="btn btn-danger-glass btn-sm" id="logout-btn" title="Sign out">
        <i class="bi bi-box-arrow-right"></i>
        <span class="nav-label ms-1">Out</span>
      </button>
    </div>
  </div>
</aside>

<div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;
}

export function buildTopbar(title = '', subtitle = '') {
  return `
<div class="fp-topbar">
  <div class="fp-topbar-left">
    <button class="btn btn-glass btn-icon mobile-menu-btn d-md-none">
      <i class="bi bi-list"></i>
    </button>
    <div>
      <div style="font-family:var(--font-display);font-weight:700;font-size:1rem">${title}</div>
      ${subtitle ? `<div style="font-size:.75rem;color:var(--text-muted)">${subtitle}</div>` : ''}
    </div>
  </div>
  <div class="fp-topbar-right">
    <div id="topbar-date" class="fp-topbar-clock d-none d-md-block"></div>
    <div id="topbar-clock" class="fp-topbar-clock" style="font-size:.9rem;font-weight:600"></div>
  </div>
</div>
  `;
}

// ── Filter nav items by role ──
export function filterNavByRole(role) {
  document.querySelectorAll('.nav-item[data-roles]').forEach(item => {
    try {
      const roles = JSON.parse(item.dataset.roles || '[]');
      if (!roles.includes(role)) item.style.display = 'none';
    } catch (_) {}
  });
}
