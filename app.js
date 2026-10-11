/* FIVE app.js replacement — password recovery startup fix.
   Loads the existing app implementation from its immutable commit, patches only
   the startup navigation that was hiding the password-reset form, then runs it.
   This file replaces the current app.js; no code editing is required. */
(async function () {
  "use strict";
  const sourceUrl = "https://raw.githubusercontent.com/murtburnerlab/five/402bbc1c149e6c5117c928ade7217fe3a0a7015e/app.js";
  try {
    const response = await fetch(sourceUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error("Could not load the pinned FIVE app source (" + response.status + ").");
    let source = await response.text();

    const original = '  trackEvent("page_view");\n  home();\n}';
    const replacement = `  trackEvent("page_view");
  // Keep the password reset form visible after Supabase consumes its callback.
  let passwordRecoveryPending = false;
  try {
    passwordRecoveryPending = sessionStorage.getItem("five:password-recovery:v1") === "1";
  } catch (_) {}
  if (!passwordRecoveryPending) home();
}`;

    if (!source.includes(original)) {
      throw new Error("The expected FIVE startup block was not found; app was not started.");
    }
    source = source.replace(original, replacement);

    const script = document.createElement("script");
    script.textContent = source + "\n//# sourceURL=five-app-patched.js";
    document.head.appendChild(script);
  } catch (error) {
    console.error("FIVE failed to start:", error);
    document.body.insertAdjacentHTML("afterbegin",
      '<div style="padding:20px;font:14px Arial;background:#f1efe9;color:#111">FIVE could not load. Check your connection and refresh the page.</div>');
  }
})();
