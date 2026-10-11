/* FIVE — password recovery v4.
   Recovery query takes priority over normal route persistence. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const recoveryRequested = new URLSearchParams(location.search).get("reset-password") === "1";
  window.FIVE_PASSWORD_RECOVERY_ACTIVE = recoveryRequested;
  let resetMode = false, recoveryClient = null, observer = null;

  function client() {
    if (!window.supabase?.createClient || !window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY)
      throw new Error("Supabase configuration is missing.");
    if (!recoveryClient) recoveryClient = window.supabase.createClient(
      window.FIVE_SUPABASE_URL, window.FIVE_SUPABASE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
    );
    return recoveryClient;
  }
  function say(text, type = "error") {
    const el = $("authMessage"); if (!el) return;
    el.textContent = text || ""; el.className = "message " + type;
    if (!text) el.classList.add("hidden");
  }
  function showConfirm(visible) {
    $("authPasswordConfirmField")?.classList.toggle("hidden", !visible);
    const input = $("authPasswordConfirm");
    if (input) { input.required = visible; if (!visible) input.value = ""; }
  }
  function enforceView() {
    if (!resetMode) return;
    document.querySelectorAll("main > .view").forEach(el => el.classList.toggle("hidden", el.id !== "auth"));
    $("auth")?.classList.remove("hidden");
  }
  function enterResetMode() {
    resetMode = true;
    if ($("authTitle")) $("authTitle").textContent = "RESET PASSWORD";
    if ($("authCopy")) $("authCopy").textContent = "Choose a new password for your FIVE account.";
    if ($("authPassword")) {
      $("authPassword").disabled = false; $("authPassword").value = "";
      $("authPassword").autocomplete = "new-password"; $("authPassword").placeholder = "New password";
    }
    if ($("authEmail")) $("authEmail").autocomplete = "email";
    showConfirm(true);
    $("forgotPasswordButton")?.classList.add("hidden");
    $("authModeSwitch")?.classList.add("hidden");
    $("signOutButton")?.classList.add("hidden");
    const button = $("authSubmit");
    if (button) { button.textContent = "UPDATE PASSWORD"; button.disabled = false; button.onclick = submitNewPassword; }
    enforceView();
    if (!observer) {
      observer = new MutationObserver(enforceView);
      observer.observe($("main") || document.body, {subtree:true, attributes:true, attributeFilter:["class","style"]});
    }
    say("");
  }
  async function submitNewPassword(event) {
    event?.preventDefault?.();
    const password = $("authPassword")?.value || "";
    const confirm = $("authPasswordConfirm")?.value || "";
    if (password.length < 6) return say("Use a password with at least 6 characters.");
    if (password !== confirm) return say("Passwords do not match. Please check both fields.");
    const button = $("authSubmit");
    if (button) { button.disabled = true; button.textContent = "UPDATING…"; }
    try {
      const supa = client();
      const {data, error: sessionError} = await supa.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data?.session) throw new Error("The reset link could not be verified or has expired. Request a new reset email and open the newest link.");
      const {error} = await supa.auth.updateUser({password});
      if (error) throw error;
      resetMode = false; observer?.disconnect(); observer = null;
      if ($("authPassword")) $("authPassword").value = "";
      if ($("authPasswordConfirm")) $("authPasswordConfirm").value = "";
      showConfirm(false);
      if ($("authTitle")) $("authTitle").textContent = "PASSWORD UPDATED";
      if ($("authCopy")) $("authCopy").textContent = "Your password has been changed. Continue to FIVE.";
      if (button) {
        button.disabled = false; button.textContent = "CONTINUE TO FIVE";
        button.onclick = () => {
          const clean = new URL(location.href);
          clean.searchParams.delete("reset-password"); clean.hash = "";
          location.replace(clean.pathname + clean.search);
        };
      }
      say("Password updated successfully.", "success");
      try { await supa.auth.signOut({scope:"local"}); } catch (_) {}
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "UPDATE PASSWORD"; }
      say(error?.message || "Could not update password. Request a new reset email and try again.");
      enforceView();
    }
  }

  function addModal() {
    if ($("fiveRecoveryModal")) return;
    const style = document.createElement("style");
    style.textContent = `#fiveRecoveryModal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.48)}#fiveRecoveryModal[hidden]{display:none!important}#fiveRecoveryModal .box{width:min(480px,100%);max-height:calc(100dvh - 36px);overflow:auto;background:#f1efe9;padding:24px}#fiveRecoveryModal .top{display:flex;justify-content:space-between;align-items:center}#fiveRecoveryModal .kicker{font-size:10px;letter-spacing:.16em;color:#77736c;text-transform:uppercase}#fiveRecoveryModal h2{font-size:clamp(34px,8vw,48px);letter-spacing:-.06em;line-height:.9;margin:32px 0 10px}#fiveRecoveryModal p{font-size:13px;line-height:1.5;color:#555}#fiveRecoveryModal label{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#77736c;margin:16px 0 8px}#fiveRecoveryModal input{display:block;width:100%;border:0;border-bottom:1px solid #aaa;background:transparent;padding:12px 0;font:17px Arial;color:#111;outline:none}#fiveRecoveryModal .msg{font-size:12px;line-height:1.45;margin-top:16px;color:#7a3535}#fiveRecoveryModal .msg.ok{color:#1f5d43}#fiveRecoveryModal .actions{display:flex;gap:8px;margin-top:22px}#fiveRecoveryModal .actions button{flex:1;min-height:52px;padding:12px 10px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;border:1px solid #111}#fiveRecoveryModal .send{background:#111;color:#fff}#fiveRecoveryModal .cancel{background:transparent;color:#111}@media(max-width:520px){#fiveRecoveryModal .box{padding:22px}#fiveRecoveryModal .actions{flex-direction:column}}`;
    document.head.appendChild(style);
    const modal = document.createElement("div");
    modal.id = "fiveRecoveryModal"; modal.hidden = true; modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true"); modal.innerHTML = `<div class="box"><div class="top"><span class="kicker">FIVE · ACCOUNT RECOVERY</span><button type="button" id="fiveRecoveryClose" aria-label="Close" style="border:0;background:none;font-size:26px">×</button></div><h2>RESET PASSWORD</h2><p>Enter the email address connected to your FIVE account. We’ll send a secure password reset link.</p><form id="fiveRecoveryForm"><label for="fiveRecoveryEmail">Email</label><input id="fiveRecoveryEmail" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="254"><div id="fiveRecoveryMessage" class="msg" role="status" aria-live="polite"></div><div class="actions"><button type="submit" id="fiveRecoverySend" class="send">SEND RESET LINK</button><button type="button" id="fiveRecoveryCancel" class="cancel">CANCEL</button></div></form></div>`;
    document.body.appendChild(modal);
    const close = () => modal.hidden = true;
    $("fiveRecoveryClose").addEventListener("click",close);
    $("fiveRecoveryCancel").addEventListener("click",close);
    modal.addEventListener("click",e=>{if(e.target===modal)close();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)close();});
    $("fiveRecoveryForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const input=$("fiveRecoveryEmail"), button=$("fiveRecoverySend"), message=$("fiveRecoveryMessage");
      if(!input.checkValidity()){input.reportValidity();return;}
      button.disabled=true;button.textContent="SENDING…";message.className="msg";message.textContent="";
      try {
        const redirectTo=location.origin+location.pathname+"?reset-password=1";
        const {error}=await client().auth.resetPasswordForEmail(input.value.trim(),{redirectTo});
        if(error)throw error;
        message.className="msg ok";message.textContent="If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.";
        button.textContent="EMAIL SENT";
      } catch(error) { message.textContent=error?.message||"Could not send the reset email. Please try again.";button.disabled=false;button.textContent="SEND RESET LINK"; }
    });
  }
  window.fiveForgotPassword = () => {
    addModal(); const modal=$("fiveRecoveryModal"), input=$("fiveRecoveryEmail");
    const source=$("authEmail")?.value.trim()||""; input.value=source;
    $("fiveRecoveryMessage").textContent=""; $("fiveRecoveryMessage").className="msg";
    $("fiveRecoverySend").disabled=false; $("fiveRecoverySend").textContent="SEND RESET LINK";
    modal.hidden=false; setTimeout(()=> (source? $("fiveRecoverySend"):input).focus(),0);
  };
  addModal();
  if (recoveryRequested) {
    enterResetMode();
    // Keep the recovery view active through app.js initialization and route restoration.
    document.addEventListener("DOMContentLoaded", enterResetMode, {once:true});
    setTimeout(enterResetMode, 100);
    setTimeout(enterResetMode, 500);
    setTimeout(enterResetMode, 1500);
  } else {
    $("authPasswordConfirmField")?.classList.add("hidden");
    $("forgotPasswordButton")?.classList.remove("hidden");
  }
})();