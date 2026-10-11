/* FIVE — preserve auth callback intent before any Supabase client can consume the URL.
   Also ensure signup confirmations return to the GitHub Pages app path. */
(() => {
  "use strict";
  const RECOVERY_MARKER = "five:password-recovery:v1";

  function markRecoveryFromUrl() {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
    const hasRecoverySignal =
      q.has("code") ||
      h.get("type") === "recovery" ||
      h.has("access_token") ||
      h.has("refresh_token");
    if (q.get("reset-password") === "1" && hasRecoverySignal) {
      try { sessionStorage.setItem(RECOVERY_MARKER, "1"); } catch (_) {}
    }
  }

  // This script loads before app.js, so record the callback before supabase-js
  // can exchange the PKCE code and clean the URL.
  markRecoveryFromUrl();

  if (!window.supabase || typeof window.supabase.createClient !== "function") return;
  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  const appRedirectUrl = window.location.origin + window.location.pathname;

  window.supabase.createClient = function (...args) {
    const client = originalCreateClient(...args);
    if (client?.auth && typeof client.auth.signUp === "function") {
      const originalSignUp = client.auth.signUp.bind(client.auth);
      client.auth.signUp = function (credentials = {}, options) {
        const suppliedOptions = credentials.options || {};
        return originalSignUp({
          ...credentials,
          options: {
            ...suppliedOptions,
            ...(options || {}),
            emailRedirectTo: suppliedOptions.emailRedirectTo || options?.emailRedirectTo || appRedirectUrl
          }
        });
      };
    }
    return client;
  };
})();
