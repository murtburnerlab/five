/* FIVE — email signup confirmation and password recovery */
(() => {
  const $ = id => document.getElementById(id);
  let resetMode = false;
  let authEventHandlerAttached = false;
  const originalSetAuthMode = window.setAuthMode;
  const originalSubmitAuth = window.submitAuth;
  const originalUpdateAuthUI = window.updateAuthUI;
  if (typeof originalUpdateAuthUI === "function") {
    window.updateAuthUI = function() {
      const result = originalUpdateAuthUI();
      if (resetMode) {
        if ($("authPassword")) $("authPassword").disabled = false;
        if ($("authPasswordConfirm")) $("authPasswordConfirm").disabled = false;
        if ($("authSubmit")) $("authSubmit").disabled = false;
      }
      return result;
    };
  }

  function setConfirmVisible(visible) {
    const field = $("authPasswordConfirmField");
    if (field) field.classList.toggle("hidden", !visible);
    const input = $("authPasswordConfirm");
    if (input) {
      input.required = !!visible;
      if (!visible) input.value = "";
    }
  }

  function showForgotPassword(visible) {
    const button = $("forgotPasswordButton");
    if (button) button.classList.toggle("hidden", !visible);
  }

  function enterResetMode() {
    resetMode = true;
    if (typeof originalSetAuthMode === "function") originalSetAuthMode("signin");
    $("authTitle").textContent = "RESET PASSWORD";
    $("authCopy").textContent = "Choose a new password for your FIVE account.";
    $("authPassword").disabled = false;
    $("authPassword").autocomplete = "new-password";
    $("authPassword").value = "";
    $("authPassword").placeholder = "New password";
    setConfirmVisible(true);
    showForgotPassword(false);
    $("authModeSwitch")?.classList.add("hidden");
    $("authSubmit").textContent = "UPDATE PASSWORD";
    $("authSubmit").disabled = false;
    $("signOutButton")?.classList.add("hidden");
    $("auth").classList.remove("hidden");
    document.querySelectorAll("main > .view").forEach(v => {
      if (v.id !== "auth") v.classList.add("hidden");
    });
    history.replaceState(null, "", location.pathname + location.search);
  }

  if (typeof window.setAuthMode === "function") {
    window.setAuthMode = function(mode) {
      if (resetMode) resetMode = false;
      const result = originalSetAuthMode(mode);
      setConfirmVisible(mode === "signup");
      showForgotPassword(mode !== "signup");
      $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
      $("authPassword").placeholder = "Password";
      $("authModeSwitch")?.classList.remove("hidden");
      return result;
    };
  }

  if (typeof originalSubmitAuth === "function") {
    window.submitAuth = async function() {
      if (resetMode) {
        const password = $("authPassword").value;
        const confirm = $("authPasswordConfirm").value;
        if (password.length < 6) {
          const el = $("authMessage");
          el.textContent = "Use a password with at least 6 characters.";
          el.className = "message error";
          return;
        }
        if (password !== confirm) {
          const el = $("authMessage");
          el.textContent = "Passwords do not match. Please check both fields.";
          el.className = "message error";
          return;
        }
        $("authSubmit").disabled = true;
        $("authSubmit").textContent = "UPDATING...";
        const { error } = await window.supabase.createClient(
          window.FIVE_SUPABASE_URL,
          window.FIVE_SUPABASE_KEY,
          { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
        ).auth.updateUser({ password });
        $("authSubmit").disabled = false;
        $("authSubmit").textContent = "UPDATE PASSWORD";
        if (error) {
          const el = $("authMessage");
          el.textContent = error.message || "Could not update password. Request a new reset email and try again.";
          el.className = "message error";
          return;
        }
        resetMode = false;
        $("authPassword").value = "";
        $("authPasswordConfirm").value = "";
        setConfirmVisible(false);
        $("authTitle").textContent = "PASSWORD UPDATED";
        $("authCopy").textContent = "Your password has been changed. Sign in with your new password.";
        $("authSubmit").textContent = "SIGN IN";
        $("authModeSwitch")?.classList.remove("hidden");
        $("authModeSwitch").textContent = "CREATE ACCOUNT";
        showForgotPassword(true);
        const el = $("authMessage");
        el.textContent = "Password updated successfully. You can now sign in with your new password.";
        el.className = "message success";
        return;
      }

      if ($("authTitle")?.textContent === "CREATE ACCOUNT") {
        const password = $("authPassword").value;
        const confirm = $("authPasswordConfirm")?.value || "";
        if (password.length < 6) {
          const el = $("authMessage");
          el.textContent = "Use a password with at least 6 characters.";
          el.className = "message error";
          return;
        }
        if (password !== confirm) {
          const el = $("authMessage");
          el.textContent = "Passwords do not match. Please check both fields.";
          el.className = "message error";
          return;
        }
      }
      return originalSubmitAuth();
    };
  }

  window.fiveForgotPassword = async function() {
    const email = $("authEmail").value.trim();
    if (!email) {
      const el = $("authMessage");
      el.textContent = "Enter your email address first. We will send a password reset link to that address.";
      el.className = "message error";
      $("authEmail").focus();
      return;
    }
    const button = $("forgotPasswordButton");
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "SENDING...";
    const client = window.supabase.createClient(
      window.FIVE_SUPABASE_URL,
      window.FIVE_SUPABASE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
    const redirectTo = location.origin + location.pathname + "?reset-password=1";
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    button.disabled = false;
    button.textContent = originalText;
    const el = $("authMessage");
    if (error) {
      el.textContent = error.message || "Could not send the reset email. Please try again.";
      el.className = "message error";
    } else {
      el.textContent = "If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.";
      el.className = "message success";
    }
  };

  function watchRecoveryEvent() {
    if (authEventHandlerAttached || !window.supabase?.createClient) return;
    authEventHandlerAttached = true;
    const client = window.supabase.createClient(
      window.FIVE_SUPABASE_URL,
      window.FIVE_SUPABASE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
    client.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") enterResetMode();
    });
    if (new URLSearchParams(location.search).get("reset-password") === "1" &&
        location.hash.includes("type=recovery")) {
      enterResetMode();
    }
  }

  // app.js initializes Supabase before this script is loaded.
  watchRecoveryEvent();
  if (new URLSearchParams(location.search).get("reset-password") === "1" &&
      location.hash.includes("type=recovery")) {
    enterResetMode();
  }
  setConfirmVisible(false);
  showForgotPassword(true);
})();