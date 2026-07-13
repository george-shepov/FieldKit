(function() {
  const currentScript = document.currentScript;
  const scriptURL = currentScript && currentScript.src
    ? new URL(currentScript.src, window.location.href)
    : new URL("shared/components.js", document.baseURI);
  const rootURL = new URL("../", scriptURL);

  // 1. Inject Shadcn CSS and Lucide for pages running without the unified shell.
  const injectStyles = () => {
    if (!document.querySelector('link[href*="shadcn.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('shared/shadcn.css', rootURL).toString();
      document.head.appendChild(link);
    }

    if (!window.lucide && !document.querySelector('script[src*="lucide"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/lucide@latest';
      script.onload = () => window.lucide && window.lucide.createIcons();
      document.head.appendChild(script);
    }
  };

  function unifiedShellIsPresent() {
    return Boolean(document.querySelector('[data-fieldkit-unified-shell], .fk-shell-header'));
  }

  function removeLegacyHeaders() {
    document.querySelectorAll('.suite-nav, .s-header').forEach((nav) => nav.remove());
  }

  // 2. Modern fallback header for pages opened outside the PWA/service-worker shell.
  const createHeader = () => {
    removeLegacyHeaders();

    // The service worker injects the canonical FieldKit shell. Do not add a
    // second header inside the app when that marker is present.
    if (unifiedShellIsPresent()) return;

    const header = document.createElement('nav');
    header.className = 's-header flex items-center justify-between p-4';
    header.style.cssText = `
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      align-self: stretch;
      flex: 0 0 auto;
      background: hsl(var(--background) / 0.8);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid hsl(var(--border));
      min-height: 56px;
      margin-bottom: 8px;
    `;

    const backPath = new URL('index.html', rootURL).toString();

    header.innerHTML = `
      <div class="flex items-center gap-4">
        <a href="${backPath}" class="s-btn s-btn-ghost s-btn-sm" style="gap: 4px;">
          <i data-lucide="arrow-left" size="16" aria-hidden="true"></i> Lobby
        </a>
        <div class="flex items-center gap-2">
          <div style="width: 24px; height: 24px; border-radius: 6px; background: linear-gradient(135deg, #6366f1, #a855f7);"></div>
          <span class="font-semibold" style="letter-spacing: -0.01em;">FieldKit</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button id="sharedHelpBtn" class="s-btn s-btn-ghost s-btn-icon s-btn-sm" title="Help (F1)" aria-label="Help">
          <i data-lucide="help-circle" size="18" aria-hidden="true"></i>
        </button>
      </div>
    `;

    document.body.prepend(header);
    if (window.lucide) window.lucide.createIcons();

    const helpBtn = document.getElementById('sharedHelpBtn');
    if (helpBtn) {
      helpBtn.onclick = () => {
        if (window.openHelp) window.openHelp();
        else window.location.href = new URL('index.html?help=1', rootURL).toString();
      };
    }

    // Defensive cleanup for environments that attach the unified shell after
    // DOMContentLoaded (including an already-installed PWA updating in place).
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.fk-shell-header')) return;
      removeLegacyHeaders();
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true });
  };

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
