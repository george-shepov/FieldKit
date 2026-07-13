(() => {
  'use strict';

  const currentScript = document.currentScript;
  const scriptURL = currentScript && currentScript.src
    ? new URL(currentScript.src, window.location.href)
    : new URL('shared/app-extensions.js', document.baseURI);
  const sharedRoot = new URL('./', scriptURL);

  const EXTERNAL_APPS = {
    'vocabulary-expander': {
      name: 'Vocabulary Expander',
      desc: 'Estimate vocabulary and learn unfamiliar words',
      icon: 'languages.svg',
      path: 'https://george-shepov.github.io/Vocabulary-Expander/',
      offline: 'hybrid',
      free: true,
      sourceRepo: 'george-shepov/Vocabulary-Expander'
    },
    'developer-interview-prep': {
      name: 'Developer Interview Prep',
      desc: 'Offline SQL, .NET, JavaScript and interview reference',
      icon: 'code-2.svg',
      path: 'https://george-shepov.github.io/developer-interview-prep/',
      offline: 'hybrid',
      free: true,
      sourceRepo: 'george-shepov/developer-interview-prep'
    }
  };

  function loadLauncherExplorer() {
    if (!document.getElementById('content')) return;

    if (!document.getElementById('fieldkitLauncherExplorerStyle')) {
      const link = document.createElement('link');
      link.id = 'fieldkitLauncherExplorerStyle';
      link.rel = 'stylesheet';
      link.href = new URL('launcher-explorer.css', sharedRoot).toString();
      document.head.appendChild(link);
    }

    if (!document.getElementById('fieldkitLauncherExplorerScript')) {
      const script = document.createElement('script');
      script.id = 'fieldkitLauncherExplorerScript';
      script.src = new URL('launcher-explorer.js', sharedRoot).toString();
      script.defer = true;
      document.body.appendChild(script);
    }
  }

  function registerExternalLearningApps() {
    try {
      if (typeof APP_REGISTRY === 'undefined' || !APP_REGISTRY.education) return false;

      Object.assign(APP_REGISTRY.education.apps, EXTERNAL_APPS);

      if (typeof APP_HELP !== 'undefined') {
        APP_HELP['vocabulary-expander'] = {
          feature: 'Estimate receptive vocabulary, select unfamiliar words from reading material, and create flashcards.',
          scenario: 'Open the independent Vocabulary Expander app before a course or reading session to establish a baseline and build a learning list.'
        };
        APP_HELP['developer-interview-prep'] = {
          feature: 'Search and study SQL, .NET, JavaScript, cloud, database, behavioral, and interview questions in an installable offline-first app.',
          scenario: 'Open the independent Developer Interview Prep app when preparing for a specific role or reviewing technical topics.'
        };
      }

      if (typeof scanApps === 'function' && typeof renderCurrentLauncher === 'function') {
        cachedApps = scanApps();
        renderCurrentLauncher(cachedApps);
        if (typeof renderHelp === 'function') renderHelp(cachedApps);
      }
      return true;
    } catch (error) {
      console.warn('[FieldKit] External app registration failed:', error);
      return false;
    }
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const registered = registerExternalLearningApps();
    if (registered || attempts >= 20) {
      window.clearInterval(timer);
      loadLauncherExplorer();
    }
  }, 50);
})();
