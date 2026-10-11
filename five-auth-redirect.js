/* FIVE — email redirects and single-owner recovery token handling. */
(() => {
  if (!window.supabase || typeof window.supabase.createClient !== "function") return;
  const originalCreateClient = window.supabase.createClient.bind(window.supabase);
  const recovery = new URLSearchParams(window.location.search).get("reset-password") === "1";
  const appRedirectUrl = window.location.origin + window.location.pathname;

  // During password recovery, exactly one script must process the URL fragment.
  // The recovery handler explicitly calls auth.setSession() after app startup.
  window.supabase.createClient = function (...args) {
    const options = args[2] || {};
    const auth = options.auth || {};
    args[2] = {
      ...options,
      auth: {
        ...auth,
        ...(recovery ? { detectSessionInUrl: false } : {})
      }
    };
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