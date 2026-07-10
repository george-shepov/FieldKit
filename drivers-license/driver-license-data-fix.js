(function () {
  if (window.__fieldKitDriverLicenseDataFixLoaded) return;
  window.__fieldKitDriverLicenseDataFixLoaded = true;

  function languagePrompt(line) {
    const text = String(line || "");
    if (/[ІіЇїЄєҐґ]/.test(text)) return "Доповніть правило дорожнього руху";
    if (/[А-Яа-яЁё]/.test(text)) return "Дополните правило дорожного движения";
    if (/[¿¡áéíóúñ]/i.test(text)) return "Complete la regla de conducción";
    if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return "Complétez la règle de conduite";
    if (/[äöüß]/i.test(text)) return "Vervollständigen Sie die Fahrregel";
    return "Complete the driving rule";
  }

  function makeDigestCard(line) {
    const answer = String(line || "").replace(/\s+/g, " ").trim();
    const words = answer.split(" ").filter(Boolean);
    const hiddenCount = Math.min(5, Math.max(2, Math.round(words.length * 0.3)));
    const visible = words.slice(hiddenCount).join(" ");
    return {
      q: `${languagePrompt(answer)}: ______ ${visible}`.trim(),
      a: answer
    };
  }

  function applyFix() {
    if (
      typeof PACKS === "undefined" ||
      typeof dedupeCards !== "function" ||
      typeof rebuildOrder !== "function" ||
      typeof refreshAll !== "function"
    ) {
      return false;
    }

    digestToCards = function (lines) {
      return (lines || []).map(makeDigestCard).filter(card => card.q && card.a);
    };

    const generatedQuestion = /^(?:Digest check\s+\d+:|Complete the driving rule:|Дополните правило дорожного движения:|Доповніть правило дорожнього руху:|Complete la regla de conducción:|Complétez la règle de conduite:|Vervollständigen Sie die Fahrregel:)/i;

    for (const pack of Object.values(PACKS)) {
      const authoredCards = (pack.qa || []).filter(card =>
        !generatedQuestion.test(String(card && card.q || ""))
      );
      pack.qa = dedupeCards([
        ...authoredCards,
        ...digestToCards(pack.digest || [])
      ]);
    }

    if (typeof state !== "undefined" && state.track === "driver") {
      rebuildOrder();
      refreshAll();
    }

    return true;
  }

  let attempts = 0;
  (function waitForDriverLicenseApp() {
    if (applyFix()) return;
    attempts += 1;
    if (attempts < 40) window.setTimeout(waitForDriverLicenseApp, 50);
  })();
})();
