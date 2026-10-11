/* FIVE — password recovery flow. Handles Supabase links even when app.js consumes the URL hash first. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const recoveryRequested = params.get("reset-password") === "1";
  let resetMode = false;
  let recoveryClient = null;
  let recoveryObserver = null;
  let resetViewLock = false;

  function client() {
    if (!window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY || !window.supabase?.createClient) {
      throw new Error("Supabase configuration is missing.");
    }
    if (!recoveryClient) {
      recoveryClient = window.supabase.createClient(
        window.FIVE_SUPABASE_URL,
        window.FIVE_SUPABASE_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
      );
    }
    return recoveryClient;
  }

  function setMessage(text, type = "error") {
    const el = $("authMessage");
    if (!el) return;
    el.textContent = text;
    el.className = "message " + type;
  }

  function setConfirmVisible(visible) {
    const field = $("authPasswordConfirmField");
    const input = $("authPasswordConfirm");
    if (field) field.classList.toggle("hidden", !visible);
    if (input) {
      input.required = !!visible;
      if (!visible) input.value = "";
    }
  }

  function enforceResetView() {
    if (!resetMode || resetViewLock) return;
    resetViewLock = true;
    document.querySelectorAll("main > .view").forEach(v => {
      if (v.id !== "auth") v.classList.add("hidden");
    });
    $("auth")?.classList.remove("hidden");
    resetViewLock = false;
  }

  function enterResetMode() {
    if (resetMode) {
      enforceResetView();
      return;
    }
    resetMode = true;
    if (typeof window.setAuthMode === "function") {
      try { window.setAuthMode("signin"); } catch (_) {}
    }
    if ($("authTitle")) $("authTitle").textContent = "RESET PASSWORD";
    if ($("authCopy")) $("authCopy").textContent = "Choose a new password for your FIVE account.";
    if ($("authPassword")) {
      $("authPassword").disabled = false;
      $("authPassword").autocomplete = "new-password";
      $("authPassword").value = "";
      $("authPassword").placeholder = "New password";
    }
    setConfirmVisible(true);
    if ($("forgotPasswordButton")) $("forgotPasswordButton").classList.add("hidden");
    $("authModeSwitch")?.classList.add("hidden");
    if ($("authSubmit")) {
      $("authSubmit").textContent = "UPDATE PASSWORD";
      $("authSubmit").disabled = false;
      $("authSubmit").onclick = submitNewPassword;
    }
    $("signOutButton")?.classList.add("hidden");
    enforceResetView();
    if (!recoveryObserver) {
      recoveryObserver = new MutationObserver(enforceResetView);
      recoveryObserver.observe(document.querySelector("main") || document.body, {
        subtree: true, attributes: true, attributeFilter: ["class", "style"]
      });
    }
    if ($("authMessage")) {
      $("authMessage").textContent = "";
      $("authMessage").className = "message hidden";
    }
    setTimeout(() => $("authPassword")?.focus(), 0);
  }

  async function submitNewPassword() {
    const password = $("authPassword")?.value || "";
    const confirm = $("authPasswordConfirm")?.value || "";
    if (password.length < 6) {
      setMessage("Use a password with at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match. Please check both fields.");
      return;
    }
    const button = $("authSubmit");
    button.disabled = true;
    button.textContent = "UPDATING…";
    try {
      const supa = client();
      const { data: sessionData, error: sessionError } = await supa.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) {
        throw new Error("The reset link is invalid or expired. Request a new password reset email and open the newest link.");
      }
      const { error } = await supa.auth.updateUser({ password });
      if (error) throw error;

      resetMode = false;
      recoveryObserver?.disconnect();
      recoveryObserver = null;
      $("authPassword").value = "";
      $("authPasswordConfirm").value = "";
      setConfirmVisible(false);
      if ($("authTitle")) $("authTitle").textContent = "PASSWORD UPDATED";
      if ($("authCopy")) $("authCopy").textContent = "Your password has been changed. Continue to FIVE.";
      $("authModeSwitch")?.classList.add("hidden");
      if ($("forgotPasswordButton")) $("forgotPasswordButton").classList.add("hidden");
      button.textContent = "CONTINUE TO FIVE";
      button.disabled = false;
      button.onclick = () => { location.href = location.pathname + location.search.replace(/[?&]reset-password=1(&|$)/, (m, sep) => sep === "&" ? "?" : ""); };
      setMessage("Password updated successfully.", "success");
      try { await client().auth.signOut({ scope: "local" }); } catch (_) {}
    } catch (error) {
      button.disabled = false;
      button.textContent = "UPDATE PASSWORD";
      setMessage(error?.message || "Could not update password. Request a new reset email and try again.");
      enforceResetView();
    }
  }

  function addModal() {
    if ($("fiveRecoveryModal")) return;
    const style = document.createElement("style");
    style.textContent = `
      #fiveRecoveryModal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.48)}
      #fiveRecoveryModal[hidden]{display:none!important}
      #fiveRecoveryModal .five-recovery-box{width:min(480px,100%);max-height:calc(100dvh - 36px);overflow:auto;background:#f1efe9;padding:24px}
      #fiveRecoveryModal .five-recovery-top{display:flex;justify-content:space-between;align-items:center;gap:12px}
      #fiveRecoveryModal .five-recovery-kicker{font-size:10px;letter-spacing:.16em;color:#77736c;text-transform:uppercase}
      #fiveRecoveryModal h2{font-size:clamp(34px,8vw,48px);letter-spacing:-.06em;line-height:.9;margin:32px 0 10px}
      #fiveRecoveryModal p{font-size:13px;line-height:1.5;color:#555;margin:0 0 18px}
      #fiveRecoveryModal label{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#77736c;margin:16px 0 8px}
      #fiveRecoveryModal input{display:block;width:100%;border:0;border-bottom:1px solid #aaa;background:transparent;padding:12px 0;font:17px Arial,Helvetica,sans-serif;color:#111;outline:none;border-radius:0}
      #fiveRecoveryModal input:focus{border-bottom-color:#1685ff}
      #fiveRecoveryModal .five-recovery-message{font-size:12px;line-height:1.45;margin:16px 0 0;color:#7a3535;overflow-wrap:anywhere}
      #fiveRecoveryModal .five-recovery-message.success{color:#1f5d43}
      #fiveRecoveryModal .five-recovery-actions{display:flex;gap:8px;margin-top:22px}
      #fiveRecoveryModal .five-recovery-actions button{flex:1;min-height:52px;padding:12px 10px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;border:1px solid #111}
      #fiveRecoveryModal .five-recovery-send{background:#111;color:#fff}
      #fiveRecoveryModal .five-recovery-cancel{background:transparent;color:#111}
      #fiveRecoveryModal button:disabled{opacity:.55;cursor:wait}
      @media(max-width:520px){#fiveRecoveryModal .five-recovery-box{padding:22px}#fiveRecoveryModal .five-recovery-actions{flex-direction:column}}
    `;
    document.head.appendChild(style);
    const modal = document.createElement("div");
    modal.id = "fiveRecoveryModal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "fiveRecoveryTitle");
    modal.innerHTML = `
      <div class="five-recovery-box">
        <div class="five-recovery-top"><span class="five-recovery-kicker">FIVE · ACCOUNT RECOVERY</span><button type="button" id="fiveRecoveryClose" aria-label="Close" style="border:0;background:none;font-size:26px;padding:0">×</button></div>
        <h2 id="fiveRecoveryTitle">RESET PASSWORD</h2>
        <p>Enter the email address connected to your FIVE account. We’ll send a secure password reset link.</p>
        <form id="fiveRecoveryForm">
          <label for="fiveRecoveryEmail">Email</label>
          <input id="fiveRecoveryEmail" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="254">
          <div id="fiveRecoveryMessage" class="five-recovery-message" role="status" aria-live="polite"></div>
          <div class="five-recovery-actions"><button type="submit" class="five-recovery-send" id="fiveRecoverySend">SEND RESET LINK</button><button type="button" id="fiveRecoveryCancel" class="five-recovery-cancel">CANCEL</button></div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    const close = () => { modal.hidden = true; };
    $("fiveRecoveryClose").addEventListener("click", close);
    $("fiveRecoveryCancel").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) close(); });
    $("fiveRecoveryForm").addEventListener("submit", sendResetEmail);
  }

  async function sendResetEmail(event) {
    event.preventDefault();
    const input = $("fiveRecoveryEmail");
    const button = $("fiveRecoverySend");
    const message = $("fiveRecoveryMessage");
    if (!input.checkValidity()) { input.reportValidity(); return; }
    button.disabled = true;
    button.textContent = "SENDING…";
    message.className = "five-recovery-message";
    message.textContent = "";
    try {
      const redirectTo = location.origin + location.pathname + "?reset-password=1";
      const { error } = await client().auth.resetPasswordForEmail(input.value.trim(), { redirectTo });
      if (error) throw error;
      message.className = "five-recovery-message success";
      message.textContent = "If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.";
      button.textContent = "EMAIL SENT";
    } catch (error) {
      message.textContent = error?.message || "Could not send the reset email. Please try again.";
      button.disabled = false;
      button.textContent = "SEND RESET LINK";
    }
  }

  window.fiveForgotPassword = function() {
    addModal();
    const modal = $("fiveRecoveryModal");
    const input = $("fiveRecoveryEmail");
    const source = $("authEmail")?.value.trim() || "";
    input.value = source;
    $("fiveRecoveryMessage").textContent = "";
    $("fiveRecoveryMessage").className = "five-recovery-message";
    $("fiveRecoverySend").disabled = false;
    $("fiveRecoverySend").textContent = "SEND RESET LINK";
    modal.hidden = false;
    setTimeout(() => (source ? $("fiveRecoverySend") : input).focus(), 0);
  };

  function installAuthListener() {
    try {
      client().auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") enterResetMode();
      });
    } catch (error) {
      console.error("FIVE recovery listener failed:", error);
    }
  }

  addModal();
  installAuthListener();

  // app.js creates its own Supabase client first and may consume the URL hash before this file runs.
  // The explicit redirect query is therefore the durable signal that this page is a recovery landing.
  if (recoveryRequested) {
    enterResetMode();
    setTimeout(enterResetMode, 400);
    setTimeout(enterResetMode, 1200);
  } else {
    if ($("authPasswordConfirmField")) $("authPasswordConfirmField").classList.add("hidden");
    if ($("forgotPasswordButton")) $("forgotPasswordButton").classList.remove("hidden");
  }
})();
