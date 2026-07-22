(() => {
  'use strict';

  const currentScript = document.currentScript;
  const scriptURL = currentScript && currentScript.src
    ? new URL(currentScript.src, window.location.href)
    : new URL('shared/app-extensions.js', document.baseURI);
  const sharedRoot = new URL('./', scriptURL);
  const LIBRARY_VERSION = '2026.07.22.1';

  const EXTERNAL_LEARNING_APPS = {
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

  const EXTERNAL_GAME_APPS = {
    'spades-royale': {
      name: 'Spades Royale',
      desc: 'Premium partnership card game with smart AI, nil bids, saved matches, and tutorial',
      icon: 'trophy.svg',
      path: 'https://gogames.xyz/games/spades/',
      offline: 'hybrid',
      free: true,
      sourceRepo: 'george-shepov/gogames.xyz'
    }
  };

  function isLauncherPage() {
    return Boolean(
      document.getElementById('content') &&
      document.querySelector('.launcher-controls') &&
      typeof APP_REGISTRY !== 'undefined'
    );
  }

  function loadLauncherLibrary() {
    if (!isLauncherPage()) return;

    if (!document.getElementById('fieldkitLauncherLibraryStyle')) {
      const link = document.createElement('link');
      link.id = 'fieldkitLauncherLibraryStyle';
      link.rel = 'stylesheet';
      const href = new URL('launcher-library.css', sharedRoot);
      href.searchParams.set('v', LIBRARY_VERSION);
      link.href = href.toString();
      document.head.appendChild(link);
    }

    if (!document.getElementById('fieldkitLauncherLibraryScript')) {
      const script = document.createElement('script');
      script.id = 'fieldkitLauncherLibraryScript';
      const src = new URL('launcher-library.js', sharedRoot);
      src.searchParams.set('v', LIBRARY_VERSION);
      script.src = src.toString();
      script.defer = true;
      document.body.appendChild(script);
    }
  }

  function registerExternalApps() {
    try {
      if (
        typeof APP_REGISTRY === 'undefined' ||
        !APP_REGISTRY.education ||
        !APP_REGISTRY.games
      ) return false;

      Object.assign(APP_REGISTRY.education.apps, EXTERNAL_LEARNING_APPS);
      Object.assign(APP_REGISTRY.games.apps, EXTERNAL_GAME_APPS);

      if (typeof APP_HELP !== 'undefined') {
        APP_HELP['vocabulary-expander'] = {
          feature: 'Estimate receptive vocabulary, select unfamiliar words from reading material, and create flashcards.',
          scenario: 'Open the independent Vocabulary Expander app before a course or reading session to establish a baseline and build a learning list.'
        };
        APP_HELP['developer-interview-prep'] = {
          feature: 'Search and study SQL, .NET, JavaScript, cloud, database, behavioral, and interview questions in an installable offline-first app.',
          scenario: 'Open the independent Developer Interview Prep app when preparing for a specific role or reviewing technical topics.'
        };
        APP_HELP['spades-royale'] = {
          feature: 'Play full partnership Spades matches with smart bots, legal-play guidance, nil bidding, bag scoring, saved progress, statistics, and an interactive tutorial.',
          scenario: 'Open Spades Royale for a polished card-game break or use the tutorial to learn bidding, following suit, trumping, nil, and bags.'
        };
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
    const registered = registerExternalApps();
    if (registered || attempts >= 20) {
      window.clearInterval(timer);
      loadLauncherLibrary();
    }
  }, 50);
})();
