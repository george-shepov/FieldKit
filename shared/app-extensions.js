(() => {
  'use strict';

  function registerVocabularyExpander() {
    try {
      if (typeof APP_REGISTRY === 'undefined' || !APP_REGISTRY.education) return false;

      APP_REGISTRY.education.apps['vocabulary-expander'] = {
        name: 'Vocabulary Expander',
        desc: 'Estimate vocabulary + collect unfamiliar words',
        icon: 'languages.svg',
        free: true
      };

      if (typeof APP_HELP !== 'undefined') {
        APP_HELP['vocabulary-expander'] = {
          feature: 'Estimate receptive vocabulary, measure developer/legal terminology recognition, and collect unfamiliar words from pasted text.',
          scenario: 'Use before a course, interview, document review, or study session to establish a baseline and create a focused learning queue.'
        };
      }

      if (typeof scanApps === 'function' && typeof renderCurrentLauncher === 'function') {
        cachedApps = scanApps();
        renderCurrentLauncher(cachedApps);
        if (typeof renderHelp === 'function') renderHelp(cachedApps);
      }
      return true;
    } catch (error) {
      console.warn('[FieldKit] Vocabulary launcher extension failed:', error);
      return false;
    }
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (registerVocabularyExpander() || attempts >= 20) window.clearInterval(timer);
  }, 50);
})();
