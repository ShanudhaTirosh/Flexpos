// ============================================================
// FlexPOS — Theme Module
// Dark / light mode toggle with localStorage persistence
// ============================================================

export function initTheme() {
  const saved = localStorage.getItem('fp_theme') || 'dark';
  applyTheme(saved);

  // Bind toggle buttons
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next    = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('fp_theme', next);
      updateIcons(next);
    });
  });

  updateIcons(saved);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
}

function updateIcons(theme) {
  document.querySelectorAll('[data-theme-toggle] i').forEach(icon => {
    icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
  });
  document.querySelectorAll('[data-theme-label]').forEach(el => {
    el.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  });
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}
