/* FIVE — password recovery v5: one explicit session exchange, no competing URL parsers. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const recoveryRequested = new URLSearchParams(location.search).get("reset-password") === "1";
  let recoveryClient = null, observer = null, resetMode = false, sessionReady = false;
  const client = () => {
    if (!window.supabase?.createClient || !window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY)
      throw new Error("Supabase configuration is missing.");
    if (!recoveryClient) recoveryClient = window.supabase.createClient(
      window.FIVE_SUPABASE_URL, window.FIVE_SUPABASE_KEY,
      {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}
    );
    return recoveryClient;
  };
  function message(text, type="error") {
    const el=$("authMessage"); if(!el)return;
    el.textContent=text||""; el.className="message "+type;
    if(!text)el.classList.add("hidden");
  }
  function confirmVisible(yes) {
    $("authPasswordConfirmField")?.classList.toggle("hidden",!yes);
    const input=$("authPasswordConfirm");
    if(input){input.required=yes;if(!yes)input.value="";}
  }
  function enforceView() {
    if(!resetMode)return;
    document.querySelectorAll("main > .view").forEach(el=>el.classList.toggle("hidden",el.id!=="auth"));
    $("auth")?.classList.remove("hidden");
  }
  function enterResetMode() {
    resetMode=true;
    if($("authTitle"))$("authTitle").textContent="RESET PASSWORD";
    if($("authCopy"))$("authCopy").textContent="Choose a new password for your FIVE account.";
    if($("authPassword")){ $("authPassword").disabled=false; $("authPassword").value=""; $("authPassword").autocomplete="new-password"; $("authPassword").placeholder="New password"; }
    confirmVisible(true);
    $("forgotPasswordButton")?.classList.add("hidden");
    $("authModeSwitch")?.classList.add("hidden");
    $("signOutButton")?.classList.add("hidden");
    const button=$("authSubmit");
    if(button){button.textContent=sessionReady?"UPDATE PASSWORD":"VERIFYING LINK…";button.disabled=!sessionReady;button.onclick=submitPassword;}
    enforceView();
    if(!observer){observer=new MutationObserver(enforceView);observer.observe($("main")||document.body,{subtree:true,attributes:true,attributeFilter:["class","style"]});}
  }
  async function establishRecoverySession() {
    try {
      const hash = new URLSearchParams(location.hash.replace(/^#/,""));
      const access_token=hash.get("access_token");
      const refresh_token=hash.get("refresh_token");
      const type=hash.get("type");
      if(!access_token || !refresh_token || (type && type!=="recovery"))
        throw new Error("This recovery link is incomplete or expired. Request a new reset email and open its newest link.");
      const {data,error}=await client().auth.setSession({access_token,refresh_token});
      if(error)throw error;
      if(!data?.session)throw new Error("The recovery link could not be verified. Request a new reset email.");
      sessionReady=true;
      // Remove credentials from the visible URL only after setSession succeeds.
      history.replaceState(history.state,"",location.pathname+location.search);
      const button=$("authSubmit");
      if(button){button.disabled=false;button.textContent="UPDATE PASSWORD";}
      message("");
    } catch(error) {
      sessionReady=false;
      const button=$("authSubmit");
      if(button){button.disabled=true;button.textContent="LINK INVALID";}
      message(error?.message||"Could not verify the recovery link. Request a new reset email.");
    }
  }
  async function submitPassword(event) {
    event?.preventDefault?.();
    if(!sessionReady)return message("Verify the reset link before changing your password.");
    const password=$("authPassword")?.value||"", confirm=$("authPasswordConfirm")?.value||"";
    if(password.length<6)return message("Use a password with at least 6 characters.");
    if(password!==confirm)return message("Passwords do not match. Please check both fields.");
    const button=$("authSubmit"); if(button){button.disabled=true;button.textContent="UPDATING…";}
    try {
      const {error}=await client().auth.updateUser({password}); if(error)throw error;
      resetMode=false; observer?.disconnect(); observer=null;
      $("authPassword").value=""; $("authPasswordConfirm").value=""; confirmVisible(false);
      $("authTitle").textContent="PASSWORD UPDATED";
      $("authCopy").textContent="Your password has been changed. Continue to FIVE.";
      if(button){button.disabled=false;button.textContent="CONTINUE TO FIVE";button.onclick=()=>location.replace(location.pathname);}
      message("Password updated successfully.","success");
      try{await client().auth.signOut({scope:"local"});}catch(_){}
    } catch(error) {
      if(button){button.disabled=false;button.textContent="UPDATE PASSWORD";}
      message(error?.message||"Could not update password. Request a new reset email and try again.");
      enforceView();
    }
  }
  function addModal() {
    if($("fiveRecoveryModal"))return;
    const style=document.createElement("style");
    style.textContent=`#fiveRecoveryModal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.48)}#fiveRecoveryModal[hidden]{display:none!important}#fiveRecoveryModal .box{width:min(480px,100%);background:#f1efe9;padding:24px}#fiveRecoveryModal .kicker{font-size:10px;letter-spacing:.16em;color:#77736c}#fiveRecoveryModal h2{font-size:clamp(34px,8vw,48px);letter-spacing:-.06em;margin:30px 0 10px}#fiveRecoveryModal p{font-size:13px;line-height:1.5;color:#555}#fiveRecoveryModal label{display:block;font-size:10px;letter-spacing:.12em;margin:16px 0 8px}#fiveRecoveryModal input{width:100%;border:0;border-bottom:1px solid #aaa;background:transparent;padding:12px 0;font:17px Arial}#fiveRecoveryModal .msg{font-size:12px;margin-top:15px;color:#7a3535}#fiveRecoveryModal .ok{color:#1f5d43}#fiveRecoveryModal .actions{display:flex;gap:8px;margin-top:20px}#fiveRecoveryModal button{min-height:50px;padding:10px;border:1px solid #111;flex:1}#fiveRecoveryModal .send{background:#111;color:#fff}@media(max-width:520px){#fiveRecoveryModal .actions{flex-direction:column}}`;
    document.head.appendChild(style);
    const modal=document.createElement("div");modal.id="fiveRecoveryModal";modal.hidden=true;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");
    modal.innerHTML=`<div class="box"><div class="kicker">FIVE · ACCOUNT RECOVERY</div><h2>RESET PASSWORD</h2><p>Enter the email address connected to your FIVE account. We’ll send a secure reset link.</p><form id="fiveRecoveryForm"><label for="fiveRecoveryEmail">Email</label><input id="fiveRecoveryEmail" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"><div id="fiveRecoveryMessage" class="msg" role="status"></div><div class="actions"><button class="send" id="fiveRecoverySend">SEND RESET LINK</button><button type="button" id="fiveRecoveryCancel">CANCEL</button></div></form></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.hidden=true;
    $("fiveRecoveryCancel").onclick=close;modal.addEventListener("click",e=>{if(e.target===modal)close();});
    $("fiveRecoveryForm").addEventListener("submit",async e=>{
      e.preventDefault();const email=$("fiveRecoveryEmail"),button=$("fiveRecoverySend"),msg=$("fiveRecoveryMessage");
      if(!email.checkValidity()){email.reportValidity();return;}
      button.disabled=true;button.textContent="SENDING…";msg.textContent="";msg.className="msg";
      try{const redirectTo=location.origin+location.pathname+"?reset-password=1";const {error}=await client().auth.resetPasswordForEmail(email.value.trim(),{redirectTo});if(error)throw error;msg.className="msg ok";msg.textContent="If an account exists for this email, a reset link has been sent. Check your inbox and spam folder.";button.textContent="EMAIL SENT";}
      catch(error){msg.textContent=error?.message||"Could not send the reset email.";button.disabled=false;button.textContent="SEND RESET LINK";}
    });
  }
  window.fiveForgotPassword=()=>{
    addModal();const modal=$("fiveRecoveryModal"),input=$("fiveRecoveryEmail"),source=$("authEmail")?.value.trim()||"";
    input.value=source;$("fiveRecoveryMessage").textContent="";$("fiveRecoverySend").disabled=false;$("fiveRecoverySend").textContent="SEND RESET LINK";modal.hidden=false;
    setTimeout(()=> (source? $("fiveRecoverySend"):input).focus(),0);
  };
  addModal();
  if(recoveryRequested){
    enterResetMode();
    // Wait for the DOM and exchange the fragment exactly once using setSession().
    document.addEventListener("DOMContentLoaded",enterResetMode,{once:true});
    setTimeout(enterResetMode,100);setTimeout(enterResetMode,600);
    establishRecoverySession();
  }else{
    $("authPasswordConfirmField")?.classList.add("hidden");
    $("forgotPasswordButton")?.classList.remove("hidden");
  }
})();