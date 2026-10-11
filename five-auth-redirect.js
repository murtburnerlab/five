/* FIVE — preserve password recovery intent before Supabase consumes callback URL. */
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
    // The reset flag itself is enough to preserve intent. Supabase may already
    // have consumed or removed the callback parameters when later scripts run.
    if (q.get("reset-password") === "1" || h.get("type") === "recovery") {
      try { sessionStorage.setItem(RECOVERY_MARKER, "1"); } catch (_) {}
    }
    if (q.get("reset-password") === "1" && hasRecoverySignal) {
      try { sessionStorage.setItem(RECOVERY_MARKER, "1"); } catch (_) {}
    }
  }

  markRecoveryFromUrl();

  if (!window.supabase || typeof window.supabase.createClient !== "function") return;
  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  const appRedirectUrl = window.location.origin + window.location.pathname;

  window.supabase.createClient = function (...args) {
    const client = originalCreateClient(...args);
    try {
      const authOptions = args[2] || {};
      const existing = authOptions.auth || {};
      // Keep the existing app auth settings and preserve callback detection.
      client.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          try { sessionStorage.setItem(RECOVERY_MARKER, "1"); } catch (_) {}
        }
      });
    } catch (_) {}
    return client;
  };
})();
