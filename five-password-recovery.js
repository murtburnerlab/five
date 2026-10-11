/* FIVE — password recovery flow.
   Handles both Supabase PKCE (?code=...) and token-hash (#access_token=...&type=recovery)
   callbacks, and prevents normal app startup from leaving the recovery screen. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let resetMode = false;
  let recoveryBusy = false;
  let recoverySessionReady = false;
  let authEventHandlerAttached = false;

  const originalSetAuthMode = window.setAuthMode;
  const originalSubmitAuth = window.submitAuth;
  const originalUpdateAuthUI = window.updateAuthUI;

  function client() {
    // Prefer the app's shared client if the app exposes it; otherwise use a client
    // with the same project and default Supabase auth storage key.
    return window.fiveSupabaseClient || window.supabaseClient || window.supabase?.createClient?.(
      window.FIVE_SUPABASE_URL,
      window.FIVE_SUPABASE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }

  const RECOVERY_MARKER = "five:password-recovery:v1";
  function callbackIsRecovery() {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    const urlSignalsRecovery = q.get("reset-password") === "1" &&
      (q.has("code") || h.get("type") === "recovery" || h.has("access_token") || h.has("refresh_token"));
    if (urlSignalsRecovery) {
      try { sessionStorage.setItem(RECOVERY_MARKER, "1"); } catch (_) {}
      return true;
    }
    try { return sessionStorage.getItem(RECOVERY_MARKER) === "1"; } catch (_) { return false; }
  }

  function showMessage(text, type) {
    const el = $("authMessage");
    if (!el) return;
    el.textContent = text;
    el.className = "message " + (type || "");
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
    $("fiveForgotPasswordLink")?.classList.toggle("hidden", !visible);
  }

  if (typeof originalUpdateAuthUI === "function") {
    window.updateAuthUI = function() {
      const result = originalUpdateAuthUI();
      if (resetMode) {
        if ($("authPassword")) $("authPassword").disabled = false;
        if ($("authPasswordConfirm")) $("authPasswordConfirm").disabled = false;
        if ($("authSubmit")) $("authSubmit").disabled = !recoverySessionReady;
      }
      return result;
    };
  }

  function buildRecoveryUI() {
    const auth = $("auth");
    if (!auth || $("fiveForgotPasswordLink")) return;
    const style = document.createElement("style");
    style.id = "fiveRecoveryStyles";
    style.textContent = `
      #fiveForgotPasswordLink{display:inline-block;margin-top:18px;padding:0;border:0;background:none;color:#3986ff;font:inherit;font-size:11px;letter-spacing:.09em;text-transform:uppercase;text-decoration:underline;text-underline-offset:5px;cursor:pointer}
      #fiveRecoveryOverlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(17,17,17,.48)}
      #fiveRecoveryOverlay.hidden{display:none!important}
      #fiveRecoveryDialog{width:min(520px,100%);background:#f1efe9;color:#111;border:1px solid #111;padding:26px}
      #fiveRecoveryDialog .five-recovery-top{display:flex;align-items:center;justify-content:space-between;gap:16px}
      #fiveRecoveryDialog .five-recovery-logo{font-size:21px;font-weight:800;letter-spacing:-.07em}
      #fiveRecoveryDialog .five-recovery-logo span{color:#3986ff}
      #fiveRecoveryDialog .five-recovery-close{border:0;background:none;font-size:28px;line-height:1;padding:0 2px;color:#111}
      #fiveRecoveryDialog .five-recovery-eyebrow{margin-top:38px;font-size:10px;letter-spacing:.16em;color:#77736c;text-transform:uppercase}
      #fiveRecoveryDialog h2{font-size:clamp(34px,8vw,48px);line-height:.9;letter-spacing:-.07em;margin:12px 0}
      #fiveRecoveryDialog p{font-size:13px;line-height:1.5;color:#77736c;margin:15px 0 24px}
      #fiveRecoveryDialog label{display:block;font-size:10px;letter-spacing:.13em;color:#77736c;text-transform:uppercase;margin-bottom:9px}
      #fiveRecoveryEmail{display:block;width:100%;border:0;border-bottom:1px solid #111;background:transparent;border-radius:0;padding:12px 0;font:inherit;font-size:17px;color:#111;outline:none}
      #fiveRecoveryEmail:focus{border-bottom:2px solid #3986ff}
      #fiveRecoveryFeedback{font-size:12px;line-height:1.45;margin-top:14px}
      #fiveRecoveryFeedback.error{color:#7a3535}
      #fiveRecoveryFeedback.success{color:#1f5d43}
      #fiveRecoverySend{width:100%;margin-top:24px;min-height:52px;border:1px solid #111;background:#111;color:#fff;font:inherit;font-size:10px;letter-spacing:.13em;text-transform:uppercase}
      #fiveRecoverySend:disabled{opacity:.55}
      @media(max-width:520px){#fiveRecoveryDialog{padding:22px}#fiveRecoveryDialog .five-recovery-eyebrow{margin-top:30px}}
    `;
    document.head.appendChild(style);

    const link = document.createElement("button");
    link.type = "button";
    link.id = "fiveForgotPasswordLink";
    link.textContent = "FORGOT PASSWORD?";
    link.addEventListener("click", openRecoveryDialog);
    const copy = $("authCopy");
    if (copy) copy.insertAdjacentElement("afterend", link);
    else auth.querySelector(".form")?.insertAdjacentElement("beforebegin", link);

    const overlay = document.createElement("div");
    overlay.id = "fiveRecoveryOverlay";
    overlay.className = "hidden";
    overlay.innerHTML = `
      <section id="fiveRecoveryDialog" role="dialog" aria-modal="true" aria-labelledby="fiveRecoveryTitle">
        <div class="five-recovery-top"><div class="five-recovery-logo">F<span>I</span>VE</div><button type="button" class="five-recovery-close" id="fiveRecoveryClose" aria-label="Close dialog">×</button></div>
        <div class="five-recovery-eyebrow">ACCOUNT RECOVERY</div><h2 id="fiveRecoveryTitle">RESET PASSWORD.</h2>
        <p>Enter the email address linked to your FIVE account. We’ll send you a secure link to choose a new password.</p>
        <form id="fiveRecoveryForm"><label for="fiveRecoveryEmail">Email address</label><input id="fiveRecoveryEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="254"><div id="fiveRecoveryFeedback" aria-live="polite"></div><button id="fiveRecoverySend" type="submit">SEND RESET LINK</button></form>
      </section>`;
    document.body.appendChild(overlay);
    $("fiveRecoveryClose").addEventListener("click", closeRecoveryDialog);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeRecoveryDialog(); });
    $("fiveRecoveryForm").addEventListener("submit", sendRecoveryEmail);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeRecoveryDialog();
    });
  }

  function openRecoveryDialog() {
    const overlay = $("fiveRecoveryOverlay");
    if (!overlay) return;
    $("fiveRecoveryEmail").value = $("authEmail")?.value.trim() || "";
    $("fiveRecoveryFeedback").textContent = "";
    $("fiveRecoveryFeedback").className = "";
    $("fiveRecoverySend").disabled = false;
    $("fiveRecoverySend").textContent = "SEND RESET LINK";
    overlay.classList.remove("hidden");
    setTimeout(() => $("fiveRecoveryEmail")?.focus(), 30);
  }
  function closeRecoveryDialog() { $("fiveRecoveryOverlay")?.classList.add("hidden"); }

  async function sendRecoveryEmail(event) {
    event.preventDefault();
    if (recoveryBusy) return;
    const email = $("fiveRecoveryEmail").value.trim().toLowerCase();
    const feedback = $("fiveRecoveryFeedback"), button = $("fiveRecoverySend");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      feedback.textContent = "Enter a valid email address.";
      feedback.className = "error";
      $("fiveRecoveryEmail").focus();
      return;
    }
    recoveryBusy = true;
    button.disabled = true;
    button.textContent = "SENDING...";
    feedback.textContent = "";
    feedback.className = "";
    try {
      const supabase = client();
      if (!supabase) throw new Error("Authentication is temporarily unavailable. Please try again.");
      const redirectTo = location.origin + location.pathname + "?reset-password=1";
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      feedback.textContent = "If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.";
      feedback.className = "success";
      button.textContent = "EMAIL REQUESTED";
    } catch (error) {
      feedback.textContent = error?.message || "Could not send the reset email. Please try again.";
      feedback.className = "error";
      button.disabled = false;
      button.textContent = "SEND RESET LINK";
    } finally {
      recoveryBusy = false;
    }
  }

  function enterResetMode() {
    resetMode = true;
    if (typeof originalSetAuthMode === "function") originalSetAuthMode("signin");
    if ($("authTitle")) $("authTitle").textContent = "RESET PASSWORD";
    if ($("authCopy")) $("authCopy").textContent = "Choose a new password for your FIVE account.";
    if ($("authPassword")) {
      $("authPassword").disabled = false;
      $("authPassword").autocomplete = "new-password";
      $("authPassword").value = "";
      $("authPassword").placeholder = "New password";
    }
    setConfirmVisible(true);
    showForgotPassword(false);
    $("authModeSwitch")?.classList.add("hidden");
    if ($("authSubmit")) {
      $("authSubmit").textContent = "UPDATE PASSWORD";
      $("authSubmit").disabled = !recoverySessionReady;
    }
    $("signOutButton")?.classList.add("hidden");
    $("auth")?.classList.remove("hidden");
    document.querySelectorAll("main > .view").forEach(v => {
      if (v.id !== "auth") v.classList.add("hidden");
    });
  }

  if (typeof window.setAuthMode === "function") {
    window.setAuthMode = function(mode) {
      if (resetMode) resetMode = false;
      const result = originalSetAuthMode(mode);
      setConfirmVisible(mode === "signup");
      showForgotPassword(mode !== "signup");
      if ($("authPassword")) {
        $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
        $("authPassword").placeholder = "Password";
      }
      $("authModeSwitch")?.classList.remove("hidden");
      return result;
    };
  }

  if (typeof originalSubmitAuth === "function") {
    window.submitAuth = async function() {
      if (resetMode) {
        if (!recoverySessionReady) return showMessage("This reset link is not ready or has expired. Request a new password reset email.", "error");
        const password = $("authPassword").value;
        const confirm = $("authPasswordConfirm").value;
        if (password.length < 6) return showMessage("Use a password with at least 6 characters.", "error");
        if (password !== confirm) return showMessage("Passwords do not match. Please check both fields.", "error");
        $("authSubmit").disabled = true;
        $("authSubmit").textContent = "UPDATING...";
        try {
          const { error } = await client().auth.updateUser({ password });
          if (error) throw error;
          resetMode = false;
          recoverySessionReady = false;
          $("authPassword").value = "";
          $("authPasswordConfirm").value = "";
          setConfirmVisible(false);
          $("authTitle").textContent = "PASSWORD UPDATED";
          $("authCopy").textContent = "Your password has been changed. Sign in with your new password.";
          $("authSubmit").textContent = "SIGN IN";
          $("authModeSwitch")?.classList.remove("hidden");
          $("authModeSwitch").textContent = "CREATE ACCOUNT";
          showForgotPassword(true);
          showMessage("Password updated successfully. You can now sign in with your new password.", "success");
          // Explicitly sign out the recovery session so the user must authenticate
          // with the newly chosen password.
          const { error: signOutError } = await client().auth.signOut();
          if (signOutError) console.warn("FIVE recovery sign-out:", signOutError.message);
          recoverySessionReady = false;
          try { sessionStorage.removeItem(RECOVERY_MARKER); } catch (_) {}
        } catch (error) {
          showMessage(error?.message || "Could not update password. Request a new reset email and try again.", "error");
        } finally {
          $("authSubmit").disabled = false;
          $("authSubmit").textContent = resetMode ? "UPDATE PASSWORD" : "SIGN IN";
        }
        return;
      }
      if ($("authTitle")?.textContent === "CREATE ACCOUNT") {
        const password = $("authPassword").value, confirm = $("authPasswordConfirm")?.value || "";
        if (password.length < 6) return showMessage("Use a password with at least 6 characters.", "error");
        if (password !== confirm) return showMessage("Passwords do not match. Please check both fields.", "error");
      }
      return originalSubmitAuth();
    };
  }

  function activateRecoverySession(supabase) {
    if (!callbackIsRecovery()) return;
    enterResetMode();
    // Let supabase-js finish processing the callback first. The auth event is the
    // primary signal; getSession handles cases where the event fired before listener.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        showMessage("This reset link is invalid or expired. Request a new password reset email.", "error");
        return;
      }
      if (data?.session) {
        recoverySessionReady = true;
        enterResetMode();
      } else {
        // Give PKCE callback exchange a moment to complete; do not navigate away.
        setTimeout(() => {
          if (!recoverySessionReady && callbackIsRecovery()) {
            enterResetMode();
            showMessage("Verifying reset link… If this message remains, the link may be expired. Request a new one.", "");
          }
        }, 700);
      }
    }).catch(() => {});
  }

  function watchRecoveryEvent() {
    const supabase = client();
    if (!supabase || authEventHandlerAttached) return;
    authEventHandlerAttached = true;
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoverySessionReady = !!session;
        enterResetMode();
        if ($("authSubmit")) $("authSubmit").disabled = !recoverySessionReady;
      } else if (resetMode && session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        recoverySessionReady = true;
        enterResetMode();
      }
    });
    activateRecoverySession(supabase);

    // App startup currently calls home() after session initialization. While a
    // recovery callback is present, keep restoring the reset screen if startup
    // changes view visibility.
    const main = document.querySelector("main");
    if (main && callbackIsRecovery()) {
      new MutationObserver(() => {
        if (callbackIsRecovery() && resetMode && $("auth")?.classList.contains("hidden")) enterResetMode();
      }).observe(main, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  }

  buildRecoveryUI();
  watchRecoveryEvent();
  setConfirmVisible(false);
  showForgotPassword(true);
})();
