(function () {
  if (window.__fieldKitUnifiedShell) return;
  window.__fieldKitUnifiedShell = true;

  const currentScript = document.currentScript;
  const scriptURL = currentScript && currentScript.src
    ? new URL(currentScript.src, window.location.href)
    : new URL("shared/fieldkit-shell.js", document.baseURI);
  const rootURL = new URL("../", scriptURL);

  function titleFromSlug(slug) {
    return String(slug || "FieldKit App")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function getAppName() {
    const explicit = document.querySelector('meta[name="fieldkit-app-name"]');
    if (explicit && explicit.content) return explicit.content.trim();

    const heading = document.querySelector("h1");
    if (heading && heading.textContent.trim() && heading.textContent.trim().length < 70) {
      return heading.textContent.trim();
    }

    const cleanTitle = String(document.title || "")
      .replace(/\s*[|·—-]\s*FieldKit\s*$/i, "")
      .replace(/^FieldKit\s*[|·—-]\s*/i, "")
      .trim();
    if (cleanTitle && cleanTitle.toLowerCase() !== "fieldkit") return cleanTitle;

    const parts = window.location.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] === "index.html" ? parts[parts.length - 2] : parts[parts.length - 1];
    return titleFromSlug(slug);
  }

  function launcherURL() {
    return new URL("index.html", rootURL).toString();
  }

  function showToast(message) {
    let toast = document.querySelector(".fk-shell-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "fk-shell-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2400);
  }

  function enhanceTicTacToeLayout(header) {
    const board = document.getElementById("board");
    const scoreboard = document.getElementById("scoreboard");
    const sizeInput = document.getElementById("boardSize");
    if (!board || !scoreboard || !sizeInput) return;

    document.body.classList.add("fk-tic-tac-toe");

    let fitting = false;
    function fitBoard() {
      if (fitting) return;
      fitting = true;

      window.requestAnimationFrame(function () {
        const viewportHeight = window.visualViewport
          ? window.visualViewport.height
          : window.innerHeight;
        const viewportWidth = window.visualViewport
          ? window.visualViewport.width
          : window.innerWidth;

        const chromeNodes = [
          header,
          document.getElementById("topbar"),
          document.getElementById("message"),
          document.getElementById("turnbar"),
          scoreboard
        ].filter(Boolean);

        const chromeHeight = chromeNodes.reduce(function (total, node) {
          const style = window.getComputedStyle(node);
          if (style.display === "none" || style.position === "fixed") return total;
          return total + node.getBoundingClientRect().height;
        }, 0);

        const bodyStyle = window.getComputedStyle(document.body);
        const gap = parseFloat(bodyStyle.rowGap || bodyStyle.gap) || 0;
        const verticalPadding = (parseFloat(bodyStyle.paddingTop) || 0) +
          (parseFloat(bodyStyle.paddingBottom) || 0);
        const gapAllowance = gap * Math.max(0, chromeNodes.length);
        const heightAllowance = chromeHeight + gapAllowance + verticalPadding + 8;

        const byHeight = Math.max(180, viewportHeight - heightAllowance);
        const byWidth = Math.max(180, Math.min(1200, viewportWidth - 16));
        const boardPixels = Math.floor(Math.min(byHeight, byWidth));
        const boardDimension = Math.max(
          3,
          parseInt(sizeInput.value, 10) || Math.round(Math.sqrt(board.children.length)) || 10
        );

        board.style.setProperty("width", boardPixels + "px", "important");
        board.style.setProperty("height", boardPixels + "px", "important");
        board.style.gridTemplateColumns = "repeat(" + boardDimension + ", minmax(0, 1fr))";
        board.style.gridTemplateRows = "repeat(" + boardDimension + ", minmax(0, 1fr))";
        fitting = false;
      });
    }

    const boardObserver = new MutationObserver(fitBoard);
    boardObserver.observe(board, { childList: true });

    if (window.ResizeObserver) {
      const layoutObserver = new ResizeObserver(fitBoard);
      [header, scoreboard, document.getElementById("topbar"), document.getElementById("message"), document.getElementById("turnbar")]
        .filter(Boolean)
        .forEach(function (node) { layoutObserver.observe(node); });
    }

    window.addEventListener("resize", fitBoard);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", fitBoard);
    [0, 100, 400].forEach(function (delay) { window.setTimeout(fitBoard, delay); });
  }

  function createShell() {
    if (!document.body || document.querySelector(".fk-shell-header")) return;

    document.body.classList.add("fieldkit-app-shell");

    // The canonical shell replaces any legacy per-app navigation. Remove every
    // copy so delayed scripts cannot leave a broken duplicate above the app.
    document.querySelectorAll(".suite-nav, .s-header").forEach(function (nav) {
      nav.remove();
    });

    const header = document.createElement("header");
    header.className = "fk-shell-header";
    header.innerHTML = `
      <div class="fk-shell-left">
        <a class="fk-shell-link" href="${launcherURL()}" aria-label="Back to FieldKit lobby">
          <span aria-hidden="true">←</span><span>Lobby</span>
        </a>
        <div class="fk-shell-brand">
          <div class="fk-shell-logo" aria-hidden="true">FK</div>
          <div class="fk-shell-titles">
            <div class="fk-shell-product">FieldKit</div>
            <div class="fk-shell-app"></div>
          </div>
        </div>
      </div>
      <div class="fk-shell-right">
        <div class="fk-shell-status" id="fkConnectivity" aria-live="polite">
          <span class="fk-shell-status-dot" aria-hidden="true"></span>
          <span class="fk-shell-status-label"></span>
        </div>
        <button class="fk-shell-button" id="fkShellHelp" type="button" title="Help (F1)">? <span>Help</span></button>
      </div>`;

    header.querySelector(".fk-shell-app").textContent = getAppName();
    document.body.prepend(header);

    const status = header.querySelector("#fkConnectivity");
    const label = status.querySelector(".fk-shell-status-label");

    function updateConnectivity() {
      const online = navigator.onLine;
      status.classList.toggle("is-offline", !online);
      label.textContent = online ? "ONLINE · OFFLINE READY" : "AIRPLANE MODE";
      status.title = online
        ? "Connected. This FieldKit app can continue using its offline features."
        : "No network connection. Local FieldKit features remain available.";
    }

    updateConnectivity();
    window.addEventListener("online", function () {
      updateConnectivity();
      showToast("Connection restored. FieldKit is online.");
    });
    window.addEventListener("offline", function () {
      updateConnectivity();
      showToast("Airplane mode: local tools remain available.");
    });

    function openHelp() {
      if (typeof window.openHelp === "function") {
        window.openHelp();
        return;
      }
      const localHelp = document.querySelector('[data-help], #helpButton, #helpBtn, .help-button');
      if (localHelp) {
        localHelp.click();
        return;
      }
      window.location.href = new URL("help/index.html", rootURL).toString();
    }

    header.querySelector("#fkShellHelp").addEventListener("click", openHelp);
    document.addEventListener("keydown", function (event) {
      if (event.key === "F1") {
        event.preventDefault();
        openHelp();
      }
    });

    enhanceTicTacToeLayout(header);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createShell, { once: true });
  } else {
    createShell();
  }
})();
