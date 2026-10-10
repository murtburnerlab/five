/* FIVE — keep email confirmation on the GitHub Pages app path. */
(() => {
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