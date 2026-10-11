/* FIVE — modal password recovery and secure password update */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let resetMode = false;
  let authEventHandlerAttached = false;
  let recoveryClient = null;
  let recoveryPending = new URLSearchParams(location.search).get("reset-password") === "1";
  let originalHome = null;
  const originalSetAuthMode = window.setAuthMode;
  const originalSubmitAuth = window.submitAuth;
  const originalUpdateAuthUI = window.updateAuthUI;
  originalHome = window.home;
  if (typeof originalHome === "function") {
    window.home = function(...args) {
      if (recoveryPending) {
        enterResetMode();
        return;
      }
      return originalHome.apply(this, args);
    };
  }

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

  function addModal() {
    if ($("fiveRecoveryModal")) return;
    const style = document.createElement("style");
    style.id = "fiveRecoveryStyles";
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
        <div class="five-recovery-top"><span class="five-recovery-kicker">FIVE · ACCOUNT RECOVERY</span><button type="button" class="five-recovery-cancel" id="fiveRecoveryClose" aria-label="Close" style="border:0;background:none;font-size:26px;padding:0">×</button></div>
        <h2 id="fiveRecoveryTitle">RESET PASSWORD</h2>
        <p id="fiveRecoveryCopy">Enter the email address connected to your FIVE account. We’ll send you a secure password reset link.</p>
        <form id="fiveRecoveryForm">
          <label for="fiveRecoveryEmail">Email</label>
          <input id="fiveRecoveryEmail" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="254">
          <div id="fiveRecoveryMessage" class="five-recovery-message" role="status" aria-live="polite"></div>
          <div class="five-recovery-actions"><button type="submit" class="five-recovery-send" id="fiveRecoverySend">SEND RESET LINK</button><button type="button" class="five-recovery-cancel" id="fiveRecoveryCancel">CANCEL</button></div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    const close = () => { modal.hidden = true; };
    $("fiveRecoveryClose").addEventListener("click", close);
    $("fiveRecoveryCancel").addEventListener("click", close);
    modal.addEventListener("click", event => { if (event.target === modal) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) close(); });
    $("fiveRecoveryForm").addEventListener("submit", sendResetEmail);
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
    recoveryPending = true;
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
    $("auth")?.classList.remove("hidden");
    document.querySelectorAll("main > .view").forEach(v => {
      if (v.id !== "auth") v.classList.add("hidden");
    });
    const modal = $("fiveRecoveryModal");
    if (modal) modal.hidden = true;
    const msg = $("authMessage");
    if (msg) { msg.textContent = ""; msg.className = "message hidden"; }
    history.replaceState(null, "", location.pathname + location.search);
    setTimeout(() => $("authPassword")?.focus(), 0);
  }

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

  if (typeof originalSetAuthMode === "function") {
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
        const button = $("authSubmit");
        button.disabled = true;
        button.textContent = "UPDATING…";
        try {
          const { error } = await client().auth.updateUser({ password });
          if (error) throw error;
          resetMode = false;
          recoveryPending = false;
          $("authPassword").value = "";
          $("authPasswordConfirm").value = "";
          setConfirmVisible(false);
          $("authTitle").textContent = "PASSWORD UPDATED";
          $("authCopy").textContent = "Your password has been changed. Your FIVE account is ready.";
          button.textContent = "CONTINUE TO FIVE";
          button.disabled = false;
          $("authModeSwitch")?.classList.add("hidden");
          showForgotPassword(false);
          const el = $("authMessage");
          el.textContent = "Password updated successfully.";
          el.className = "message success";
          // updateUser preserves the recovery session; refresh the main app's auth state.
          const { data } = await client().auth.getSession();
          if (data?.session) {
            window.dispatchEvent(new CustomEvent("five:password-updated", { detail: { email: data.session.user?.email || "" } }));
            button.onclick = () => { location.href = location.pathname; };
          } else {
            button.textContent = "BACK TO SIGN IN";
            button.onclick = () => { window.setAuthMode?.("signin"); };
          }
        } catch (error) {
          button.disabled = false;
          button.textContent = "UPDATE PASSWORD";
          const el = $("authMessage");
          el.textContent = error?.message || "Could not update password. Request a new reset email and try again.";
          el.className = "message error";
        }
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

  async function sendResetEmail(event) {
    event.preventDefault();
    const emailInput = $("fiveRecoveryEmail");
    const button = $("fiveRecoverySend");
    const message = $("fiveRecoveryMessage");
    const email = emailInput.value.trim();
    if (!emailInput.checkValidity() || !email) {
      emailInput.reportValidity();
      return;
    }
    button.disabled = true;
    button.textContent = "SENDING…";
    message.className = "five-recovery-message";
    message.textContent = "";
    try {
      const redirectTo = location.origin + location.pathname + "?reset-password=1";
      const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      message.className = "five-recovery-message success";
      message.textContent = "If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.";
      button.textContent = "EMAIL SENT";
    } catch (error) {
      message.className = "five-recovery-message";
      message.textContent = error?.message || "Could not send the reset email. Please try again.";
      button.disabled = false;
      button.textContent = "SEND RESET LINK";
    }
  }

  window.fiveForgotPassword = function() {
    addModal();
    const modal = $("fiveRecoveryModal");
    const input = $("fiveRecoveryEmail");
    const sourceEmail = $("authEmail")?.value.trim() || "";
    input.value = sourceEmail;
    $("fiveRecoveryMessage").textContent = "";
    $("fiveRecoveryMessage").className = "five-recovery-message";
    $("fiveRecoverySend").disabled = false;
    $("fiveRecoverySend").textContent = "SEND RESET LINK";
    modal.hidden = false;
    setTimeout(() => (sourceEmail ? $("fiveRecoverySend") : input).focus(), 0);
  };

  function watchRecoveryEvent() {
    if (authEventHandlerAttached || !window.supabase?.createClient) return;
    authEventHandlerAttached = true;
    const hasRecoveryMarker = () =>
      new URLSearchParams(location.search).get("reset-password") === "1" ||
      location.hash.includes("type=recovery");

    try {
      const auth = client().auth;
      auth.onAuthStateChange(event => {
        if (event === "PASSWORD_RECOVERY") {
          recoveryPending = true;
          // app.js also restores the home view during initialization. Re-apply
          // the recovery form after that initialization has had time to finish.
          setTimeout(enterResetMode, 700);
        }
      });

      if (hasRecoveryMarker()) {
        recoveryPending = true;
        // Supabase may exchange a ?code=... PKCE callback asynchronously, and
        // app.js may consume the URL before this client reads the session.
        auth.getSession().then(({ data, error }) => {
          if (error) console.warn("FIVE recovery session check failed:", error.message);
          if (data?.session) {
            setTimeout(enterResetMode, 700);
          } else {
            // Give the primary app client time to finish exchanging the link.
            setTimeout(async () => {
              try {
                const result = await auth.getSession();
                if (result.data?.session) enterResetMode();
                else {
                  recoveryPending = false;
                  const msg = $("authMessage");
                  if (msg) {
                    msg.textContent = "This reset link may have expired or already been used. Request a new password reset email.";
                    msg.className = "message error";
                  }
                }
              } catch (_) { recoveryPending = false; }
            }, 1200);
          }
        }).catch(error => {
          recoveryPending = false;
          console.warn("FIVE recovery session check failed:", error);
        });
      }
    } catch (error) {
      console.error("FIVE password recovery initialization failed:", error);
    }
  }

  addModal();
  watchRecoveryEvent();
  setConfirmVisible(false);
  showForgotPassword(true);
})();
