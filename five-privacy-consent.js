/* FIVE privacy consent UI — additive module, no framework dependencies.
   Analytics remains off unless the visitor explicitly opts in.
*/
(function () {
  "use strict";

  var CONSENT_KEY = "five_analytics_consent";
  var styleId = "five-privacy-consent-style";
  var modalId = "five-privacy-consent";
  var copy = {
    title: "FIVE — PRIVACY SETTINGS",
    intro: "Your choice. Your privacy.",
    body: "FIVE uses essential storage to keep the app working. With your permission, we also use optional analytics to understand how people use FIVE and improve the experience.",
    detail: "You can change this choice at any time using Privacy Settings. Read the Legal page for more information.",
    accept: "ACCEPT ANALYTICS",
    reject: "REJECT ANALYTICS",
    customize: "CUSTOMIZE SETTINGS",
    save: "SAVE MY CHOICE",
    analytics: "Optional analytics",
    analyticsDetail: "Allow anonymous usage events such as page views and interactions. If you reject, these analytics events are not sent."
  };

  function getChoice() {
    try {
      var value = localStorage.getItem(CONSENT_KEY);
      return value === "accepted" || value === "rejected" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function setChoice(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
      if (value !== "accepted") localStorage.removeItem("five_visitor_id");
      return true;
    } catch (_) {
      return false;
    }
  }

  function analyticsAllowed() {
    return getChoice() === "accepted";
  }

  window.FIVE_PRIVACY_CONSENT = {
    analyticsAllowed: analyticsAllowed,
    getChoice: getChoice,
    openSettings: openSettings
  };

  function addStyles() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #${modalId}[hidden]{display:none!important}
      #${modalId}{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.55)}
      #${modalId} .five-privacy-card{width:min(480px,100%);max-height:min(90vh,760px);overflow:auto;background:var(--bg,#f1efe9);color:var(--fg,#111);padding:clamp(22px,5vw,32px);border:1px solid var(--line,#d6d2ca);box-shadow:0 18px 70px rgba(0,0,0,.18)}
      #${modalId} .five-privacy-eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#77736c)}
      #${modalId} h2{font-size:clamp(32px,8vw,46px);letter-spacing:-.065em;line-height:.92;margin:30px 0 12px}
      #${modalId} p{font-size:13px;line-height:1.5;color:var(--muted,#555);margin:12px 0}
      #${modalId} .five-privacy-actions{display:grid;gap:8px;margin-top:22px}
      #${modalId} button{width:100%;min-height:46px;padding:12px 14px;border:1px solid #111;background:transparent;color:#111;font-size:10px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
      #${modalId} button:focus-visible{outline:2px solid #1685ff;outline-offset:3px}
      #${modalId} .five-privacy-accept{background:#111;color:#fff}
      #${modalId} .five-privacy-customize{border-color:transparent;text-decoration:underline;text-underline-offset:4px}
      #${modalId} .five-privacy-toggle{display:flex;gap:12px;align-items:flex-start;padding:15px 0;margin-top:18px;border-top:1px solid var(--line,#d6d2ca);border-bottom:1px solid var(--line,#d6d2ca)}
      #${modalId} .five-privacy-toggle input{width:18px;height:18px;margin:2px 0 0;accent-color:#111;flex-shrink:0}
      #${modalId} .five-privacy-toggle label{font-size:12px;line-height:1.4}
      #${modalId} .five-privacy-toggle small{display:block;font-size:11px;color:var(--muted,#77736c);line-height:1.45;margin-top:5px}
      @media(prefers-reduced-motion:no-preference){#${modalId} .five-privacy-card{animation:fivePrivacyIn .16s ease-out}@keyframes fivePrivacyIn{from{opacity:.7;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    var existing = document.getElementById(modalId);
    if (existing) return existing;
    addStyles();
    var overlay = document.createElement("div");
    overlay.id = modalId;
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "five-privacy-title");
    overlay.innerHTML = `
      <section class="five-privacy-card">
        <div class="five-privacy-eyebrow">${copy.title}</div>
        <h2 id="five-privacy-title">${copy.intro}</h2>
        <p>${copy.body}</p>
        <p>${copy.detail}</p>
        <div class="five-privacy-custom-area" hidden>
          <div class="five-privacy-toggle">
            <input id="five-analytics-choice" type="checkbox">
            <label for="five-analytics-choice"><strong>${copy.analytics}</strong><small>${copy.analyticsDetail}</small></label>
          </div>
          <div class="five-privacy-actions">
            <button type="button" class="five-privacy-accept" data-action="save">${copy.save}</button>
            <button type="button" data-action="back">BACK</button>
          </div>
        </div>
        <div class="five-privacy-actions five-privacy-main-actions">
          <button type="button" class="five-privacy-accept" data-action="accept">${copy.accept}</button>
          <button type="button" data-action="reject">${copy.reject}</button>
          <button type="button" class="five-privacy-customize" data-action="customize">${copy.customize}</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) return; // do not dismiss without a choice
      var button = event.target.closest("button[data-action]");
      if (!button) return;
      var action = button.getAttribute("data-action");
      if (action === "accept") choose("accepted");
      else if (action === "reject") choose("rejected");
      else if (action === "customize") {
        overlay.querySelector(".five-privacy-main-actions").hidden = true;
        overlay.querySelector(".five-privacy-custom-area").hidden = false;
        overlay.querySelector("#five-analytics-choice").checked = analyticsAllowed();
        overlay.querySelector("#five-analytics-choice").focus();
      } else if (action === "back") {
        overlay.querySelector(".five-privacy-custom-area").hidden = true;
        overlay.querySelector(".five-privacy-main-actions").hidden = false;
        overlay.querySelector('[data-action="customize"]').focus();
      } else if (action === "save") {
        choose(overlay.querySelector("#five-analytics-choice").checked ? "accepted" : "rejected");
      }
    });

    overlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        // No implicit consent or dismissal. Keep the dialog open until a choice is made.
        event.preventDefault();
      }
    });
    return overlay;
  }

  function showModal() {
    var overlay = ensureModal();
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    var first = overlay.querySelector('[data-action="accept"]');
    if (first) first.focus({ preventScroll: true });
  }

  function hideModal() {
    var overlay = document.getElementById(modalId);
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = "";
  }

  function choose(value) {
    var previousChoice = getChoice();
    var saved = setChoice(value);
    hideModal();
    if (value === "accepted" && previousChoice !== "accepted") {
      // The initial page_view was suppressed before consent; record it once on opt-in.
      if (typeof window.trackEvent === "function") window.trackEvent("page_view");
    }
    if (!saved) {
      // Fail closed: when preference storage is unavailable, analytics remains off.
      try { localStorage.removeItem(CONSENT_KEY); } catch (_) {}
    }
  }

  function openSettings() {
    var overlay = ensureModal();
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    var choice = getChoice();
    overlay.querySelector(".five-privacy-main-actions").hidden = false;
    overlay.querySelector(".five-privacy-custom-area").hidden = true;
    var accept = overlay.querySelector('[data-action="accept"]');
    var reject = overlay.querySelector('[data-action="reject"]');
    accept.textContent = choice === "accepted" ? "KEEP ANALYTICS ON" : copy.accept;
    reject.textContent = choice === "rejected" ? "KEEP ANALYTICS OFF" : copy.reject;
    accept.focus({ preventScroll: true });
  }

  function init() {
    // Add a persistent footer control without modifying the app's main layout.
    var footerLinks = document.querySelector(".footer-secondary-links");
    if (footerLinks && !document.getElementById("five-privacy-settings-link")) {
      var button = document.createElement("button");
      button.id = "five-privacy-settings-link";
      button.type = "button";
      button.textContent = "PRIVACY SETTINGS";
      button.addEventListener("click", openSettings);
      footerLinks.insertBefore(button, footerLinks.firstChild);
    }
    if (!getChoice()) showModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
