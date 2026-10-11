/* FIVE — password recovery flow.
   Requires app.js and Supabase client to load first. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const MARKER = "five:password-recovery:v1";
  let resetMode = false;
  let recoverySessionReady = false;
  let busy = false;
  let authListenerInstalled = false;
  let activationStarted = false;

  function client() {
    try {
      if (typeof supabaseClient !== "undefined" && supabaseClient) return supabaseClient;
    } catch (_) {}
    return window.fiveSupabaseClient || window.supabaseClient || null;
  }
  function hasIntentInUrl() {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    return q.get("reset-password") === "1" ||
      h.get("type") === "recovery" || h.has("access_token") || h.has("refresh_token");
  }
  function isRecoveryPending() {
    try { return hasIntentInUrl() || sessionStorage.getItem(MARKER) === "1"; }
    catch (_) { return hasIntentInUrl(); }
  }
  function remember() {
    try { sessionStorage.setItem(MARKER, "1"); } catch (_) {}
  }
  function forget() {
    try { sessionStorage.removeItem(MARKER); } catch (_) {}
  }
  function cleanCallbackUrl() {
    try {
      const u = new URL(location.href);
      u.searchParams.delete("code");
      u.searchParams.delete("reset-password");
      if (u.hash && /(?:^#|&)type=recovery(?:&|$)/.test(u.hash)) u.hash = "";
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } catch (_) {}
  }
  function showMessage(text, type = "") {
    const el = $("authMessage");
    if (!el) return;
    el.textContent = text;
    el.className = "message" + (type ? " " + type : "");
    el.classList.remove("hidden");
  }
  function confirmField(show) {
    const field = $("authPasswordConfirmField");
    const input = $("authPasswordConfirm");
    if (field) field.classList.toggle("hidden", !show);
    if (input) {
      input.required = !!show;
      if (!show) input.value = "";
    }
  }
  function showForgotLink(show) {
    $("fiveForgotPasswordLink")?.classList.toggle("hidden", !show);
  }
  function showResetScreen() {
    resetMode = true;
    const auth = $("auth");
    if (!auth) return;
    auth.classList.remove("hidden");
    document.querySelectorAll("main > .view").forEach(v => {
      if (v.id !== "auth") v.classList.add("hidden");
    });
    if ($("authTitle")) $("authTitle").textContent = "RESET PASSWORD";
    if ($("authCopy")) $("authCopy").textContent = "Choose a new password for your FIVE account.";
    if ($("authPassword")) {
      $("authPassword").disabled = false;
      $("authPassword").value = "";
      $("authPassword").autocomplete = "new-password";
      $("authPassword").placeholder = "New password";
    }
    confirmField(true);
    showForgotLink(false);
    $("authModeSwitch")?.classList.add("hidden");
    $("signOutButton")?.classList.add("hidden");
    const button = $("authSubmit");
    if (button) {
      button.textContent = "UPDATE PASSWORD";
      button.disabled = !recoverySessionReady;
    }
  }
  function leaveResetScreen() {
    resetMode = false;
    recoverySessionReady = false;
    activationStarted = false;
    forget();
    $("authModeSwitch")?.classList.remove("hidden");
    confirmField(false);
    showForgotLink(true);
    if ($("authPassword")) {
      $("authPassword").autocomplete = "current-password";
      $("authPassword").placeholder = "Password";
    }
  }
  window.addEventListener("five:leave-password-recovery", () => {
    // Only explicit navigation or successful completion should leave recovery.
    if (resetMode) leaveResetScreen();
  });

  function installRequestUI() {
    if (!$("auth") || $("fiveForgotPasswordLink")) return;
    const style = document.createElement("style");
    style.id = "fiveRecoveryStyles";
    style.textContent = `
      #fiveForgotPasswordLink{display:inline-block;margin-top:18px;padding:0;border:0;background:none;color:#1685ff;font:inherit;font-size:11px;letter-spacing:.09em;text-transform:uppercase;text-decoration:underline;text-underline-offset:5px;cursor:pointer}
      #fiveRecoveryOverlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(17,17,17,.48)}
      #fiveRecoveryOverlay.hidden{display:none!important}
      #fiveRecoveryDialog{width:min(520px,100%);background:#f1efe9;color:#111;border:1px solid #111;padding:26px}
      #fiveRecoveryDialog .top{display:flex;align-items:center;justify-content:space-between;gap:16px}
      #fiveRecoveryDialog .logo{font-size:21px;font-weight:800;letter-spacing:-.07em}
      #fiveRecoveryDialog .logo span{color:#1685ff}
      #fiveRecoveryDialog .close{border:0;background:none;font-size:28px;line-height:1;padding:0 2px;color:#111}
      #fiveRecoveryDialog .eyebrow{margin-top:34px;font-size:10px;letter-spacing:.16em;color:#77736c;text-transform:uppercase}
      #fiveRecoveryDialog h2{font-size:clamp(34px,8vw,48px);line-height:.9;letter-spacing:-.07em;margin:12px 0}
      #fiveRecoveryDialog p{font-size:13px;line-height:1.5;color:#77736c;margin:15px 0 24px}
      #fiveRecoveryDialog label{display:block;font-size:10px;letter-spacing:.13em;color:#77736c;text-transform:uppercase;margin-bottom:9px}
      #fiveRecoveryEmail{display:block;box-sizing:border-box;width:100%;border:0;border-bottom:1px solid #111;background:transparent;border-radius:0;padding:12px 0;font:inherit;font-size:17px;color:#111;outline:none}
      #fiveRecoveryEmail:focus{border-bottom:2px solid #1685ff}
      #fiveRecoveryFeedback{font-size:12px;line-height:1.45;margin-top:14px}
      #fiveRecoveryFeedback.error{color:#7a3535}
      #fiveRecoveryFeedback.success{color:#1f5d43}
      #fiveRecoverySend{width:100%;margin-top:24px;min-height:52px;border:1px solid #111;background:#111;color:#fff;font:inherit;font-size:10px;letter-spacing:.13em;text-transform:uppercase;cursor:pointer}
      #fiveRecoverySend:disabled{opacity:.55}
      @media(max-width:520px){#fiveRecoveryDialog{padding:22px}}
    `;
    document.head.appendChild(style);

    const link = document.createElement("button");
    link.type = "button";
    link.id = "fiveForgotPasswordLink";
    link.textContent = "FORGOT PASSWORD?";
    link.addEventListener("click", openRequestDialog);
    $("authCopy")?.insertAdjacentElement("afterend", link);

    const overlay = document.createElement("div");
    overlay.id = "fiveRecoveryOverlay";
    overlay.className = "hidden";
    overlay.innerHTML = `
      <section id="fiveRecoveryDialog" role="dialog" aria-modal="true" aria-labelledby="fiveRecoveryTitle">
        <div class="top"><div class="logo">F<span>I</span>VE</div><button type="button" class="close" id="fiveRecoveryClose" aria-label="Close dialog">×</button></div>
        <div class="eyebrow">ACCOUNT RECOVERY</div><h2 id="fiveRecoveryTitle">RESET PASSWORD.</h2>
        <p>Enter the email address linked to your FIVE account. We’ll send you a secure link to choose a new password.</p>
        <form id="fiveRecoveryForm"><label for="fiveRecoveryEmail">Email address</label><input id="fiveRecoveryEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="254"><div id="fiveRecoveryFeedback" aria-live="polite"></div><button id="fiveRecoverySend" type="submit">SEND RESET LINK</button></form>
      </section>`;
    document.body.appendChild(overlay);
    $("fiveRecoveryClose").addEventListener("click", closeRequestDialog);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeRequestDialog(); });
    $("fiveRecoveryForm").addEventListener("submit", sendResetEmail);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !$("fiveRecoveryOverlay")?.classList.contains("hidden")) closeRequestDialog();
    });
  }
  function openRequestDialog() {
    const overlay = $("fiveRecoveryOverlay");
    if (!overlay) return;
    $("fiveRecoveryEmail").value = $("authEmail")?.value.trim() || "";
    $("fiveRecoveryFeedback").textContent = "";
    $("fiveRecoveryFeedback").className = "";
    $("fiveRecoverySend").disabled = false;
    $("fiveRecoverySend").textContent = "SEND RESET LINK";
    overlay.classList.remove("hidden");
    $("fiveRecoveryEmail")?.focus();
  }
  function closeRequestDialog() { $("fiveRecoveryOverlay")?.classList.add("hidden"); }

  async function sendResetEmail(event) {
    event.preventDefault();
    if (busy) return;
    const email = $("fiveRecoveryEmail").value.trim().toLowerCase();
    const feedback = $("fiveRecoveryFeedback");
    const button = $("fiveRecoverySend");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      feedback.textContent = "Enter a valid email address.";
      feedback.className = "error";
      return;
    }
    const supabase = client();
    if (!supabase) {
      feedback.textContent = "Authentication is temporarily unavailable. Please try again.";
      feedback.className = "error";
      return;
    }
    busy = true;
    button.disabled = true;
    button.textContent = "SENDING...";
    feedback.textContent = "";
    try {
      const redirectTo = location.origin + location.pathname + "?reset-password=1";
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      feedback.textContent = "If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.";
      feedback.className = "success";
      button.textContent = "EMAIL REQUESTED";
    } catch (e) {
      feedback.textContent = e?.message || "Could not send the reset email. Please try again.";
      feedback.className = "error";
      button.disabled = false;
      button.textContent = "SEND RESET LINK";
    } finally {
      busy = false;
    }
  }

  const originalSetAuthMode = window.setAuthMode;
  if (typeof originalSetAuthMode === "function") {
    window.setAuthMode = function(mode) {
      if (resetMode) leaveResetScreen();
      const result = originalSetAuthMode(mode);
      confirmField(mode === "signup");
      showForgotLink(mode !== "signup");
      if ($("authPassword")) {
        $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
        $("authPassword").placeholder = "Password";
      }
      $("authModeSwitch")?.classList.remove("hidden");
      return result;
    };
  }

  const originalSubmitAuth = window.submitAuth;
  if (typeof originalSubmitAuth === "function") {
    window.submitAuth = async function() {
      if (resetMode) {
        if (!recoverySessionReady) {
          showMessage("This reset link is invalid or expired. Request a new password reset email.", "error");
          return;
        }
        const password = $("authPassword")?.value || "";
        const confirm = $("authPasswordConfirm")?.value || "";
        if (password.length < 6) return showMessage("Use a password with at least 6 characters.", "error");
        if (password !== confirm) return showMessage("Passwords do not match. Please check both fields.", "error");
        const button = $("authSubmit");
        if (button) { button.disabled = true; button.textContent = "UPDATING..."; }
        try {
          const supabase = client();
          if (!supabase) throw new Error("Authentication is temporarily unavailable.");
          const { error } = await supabase.auth.updateUser({ password });
          if (error) throw error;
          cleanCallbackUrl();
          // Clear the recovery session explicitly so the user must authenticate
          // again with the newly set password.
          const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
          if (signOutError) console.warn("FIVE sign-out after password update:", signOutError.message);
          forget();
          resetMode = false;
          recoverySessionReady = false;
          confirmField(false);
          showForgotLink(true);
          if ($("authTitle")) $("authTitle").textContent = "PASSWORD UPDATED";
          if ($("authCopy")) $("authCopy").textContent = "Your password has been changed. Sign in with your new password.";
          if ($("authPassword")) {
            $("authPassword").value = "";
            $("authPassword").autocomplete = "current-password";
            $("authPassword").placeholder = "Password";
          }
          if ($("authPasswordConfirm")) $("authPasswordConfirm").value = "";
          if ($("authEmail")) $("authEmail").value = $("authEmail").value.trim().toLowerCase();
          if (button) {
            button.textContent = "SIGN IN";
            button.disabled = false;
          }
          $("authModeSwitch")?.classList.remove("hidden");
          $("authModeSwitch").textContent = "CREATE ACCOUNT";
          showMessage("Password updated successfully. Sign in with your new password.", "success");
        } catch (e) {
          showMessage(e?.message || "Could not update password. Request a new reset email and try again.", "error");
          if (button) { button.disabled = false; button.textContent = "UPDATE PASSWORD"; }
        }
        return;
      }
      if ($("authTitle")?.textContent === "CREATE ACCOUNT") {
        const p = $("authPassword")?.value || "";
        const c = $("authPasswordConfirm")?.value || "";
        if (p.length < 6) return showMessage("Use a password with at least 6 characters.", "error");
        if (p !== c) return showMessage("Passwords do not match. Please check both fields.", "error");
      }
      return originalSubmitAuth?.();
    };
  }

  function activate(supabase) {
    if (!isRecoveryPending() || activationStarted) return;
    activationStarted = true;
    remember();
    showResetScreen();

    // Supabase emits PASSWORD_RECOVERY after accepting a recovery token. Also
    // accept a live session when the explicit reset redirect flag is present.
    Promise.resolve().then(async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data?.session) {
          recoverySessionReady = true;
          showResetScreen();
          cleanCallbackUrl();
        } else {
          // Do not pretend the link is valid: show the form disabled and clear
          // the marker only when the URL contains no callback intent.
          if (!hasIntentInUrl()) {
            showMessage("This reset link could not be verified. Request a new password reset email.", "error");
          }
          if ($("authSubmit")) $("authSubmit").disabled = true;
        }
      } catch (e) {
        showMessage(e?.message || "Could not verify this reset link. Request a new one.", "error");
      }
    });
  }

  function installAuthListener() {
    const supabase = client();
    if (!supabase || authListenerInstalled) return;
    authListenerInstalled = true;
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        remember();
        recoverySessionReady = !!session;
        showResetScreen();
        cleanCallbackUrl();
      } else if (resetMode && session && ["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(event)) {
        recoverySessionReady = true;
        showResetScreen();
      }
    });
    activate(supabase);
  }

  installRequestUI();
  installAuthListener();
  // The redirect marker survives Supabase cleaning ?code= from the URL.
  if (isRecoveryPending()) activate(client());

  // Protect the recovery view from app.js init() calling home() after auth startup.
  const main = document.querySelector("main");
  if (main && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      if (resetMode && isRecoveryPending() && $("auth")?.classList.contains("hidden")) showResetScreen();
    }).observe(main, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // Restore normal field state only when not in recovery mode.
  if (!resetMode) confirmField(false);
  showForgotLink(!resetMode);
})();
