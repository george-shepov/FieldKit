(function() {
  // 1. Inject Shadcn CSS and Lucide
  const injectStyles = () => {
    if (!document.querySelector('link[href*="shadcn.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = (window.location.pathname.includes('/')) ? '../shared/shadcn.css' : 'shared/shadcn.css';
      // Adjust path for deeper nesting
      const depth = window.location.pathname.split('/').filter(Boolean).length;
      if (depth > 1) {
        link.href = '../'.repeat(depth - 1) + 'shared/shadcn.css';
      }
      document.head.appendChild(link);
    }

    if (!window.lucide && !document.querySelector('script[src*="lucide"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lucide@latest';
      script.onload = () => lucide.createIcons();
      document.head.appendChild(script);
    }
  };

  // 2. Modern Shadcn Header
  const createHeader = () => {
    const existingNav = document.querySelector('.suite-nav');
    if (existingNav) existingNav.remove();

    const header = document.createElement('nav');
    header.className = 's-header flex items-center justify-between p-4';
    header.style.cssText = `
      position: sticky;
      top: 0;
      z-index: 50;
      background: hsl(var(--background) / 0.8);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid hsl(var(--border));
      height: 56px;
      margin-bottom: 20px;
    `;

    const depth = window.location.pathname.split('/').filter(Boolean).length;
    const backPath = depth > 1 ? '../'.repeat(depth - 1) + 'index.html' : '../index.html';

    header.innerHTML = `
      <div class="flex items-center gap-4">
        <a href="${backPath}" class="s-btn s-btn-ghost s-btn-sm" style="gap: 4px;">
          <i data-lucide="arrow-left" size="16"></i> Lobby
        </a>
        <div class="flex items-center gap-2">
          <div style="width: 24px; height: 24px; border-radius: 6px; background: linear-gradient(135deg, #6366f1, #a855f7);"></div>
          <span class="font-semibold" style="letter-spacing: -0.01em;">FieldKit</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button id="sharedHelpBtn" class="s-btn s-btn-ghost s-btn-icon s-btn-sm" title="Help (F1)">
          <i data-lucide="help-circle" size="18"></i>
        </button>
      </div>
    `;

    document.body.prepend(header);
    if (window.lucide) lucide.createIcons();
    
    const helpBtn = document.getElementById('sharedHelpBtn');
    if (helpBtn) {
        helpBtn.onclick = () => {
            if (window.openHelp) window.openHelp();
            else window.location.href = backPath + '?help=1';
        };
    }
  };

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectStyles();
      createHeader();
    });
  } else {
    injectStyles();
    createHeader();
  }
})();
