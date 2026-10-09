/* FIVE achievement popup guard.
   Load this file after five-account-ui.js.
   It suppresses achievement dialogs during sign-in/account refresh and permits
   them only when the app records a new call (five:call-recorded).
*/
(() => {
  "use strict";

  let callWasRecorded = false;
  let allowTimer = null;

  function findAchievementDialog() {
    return document.querySelector(".five-achievement-backdrop");
  }

  function enforcePopupRule() {
    const dialog = findAchievementDialog();
    if (!dialog || dialog.hidden) return;

    if (!callWasRecorded) {
      dialog.hidden = true;
      return;
    }

    // A dialog was shown after a recorded call: permit this one and reset.
    callWasRecorded = false;
    if (allowTimer !== null) {
      clearTimeout(allowTimer);
      allowTimer = null;
    }
  }

  window.addEventListener("five:call-recorded", () => {
    callWasRecorded = true;

    // Do not leave the permission active indefinitely if no milestone popup
    // is produced by the asynchronous account refresh.
    if (allowTimer !== null) clearTimeout(allowTimer);
    allowTimer = setTimeout(() => {
      callWasRecorded = false;
      allowTimer = null;
    }, 15000);

    // The app's own listener also handles this event; it will refresh stats.
  });

  const observer = new MutationObserver(enforcePopupRule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden", "class", "style"]
  });

  // Handle a dialog that already exists when this guard is loaded.
  enforcePopupRule();
})();
