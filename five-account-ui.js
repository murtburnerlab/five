/* FIVE account screen state fix.
   Load after app.js and five-auth-buttons.js. */
(() => {
  const authSection = document.getElementById("auth");
  if (!authSection || document.getElementById("fiveAccountPanel")) return;

  const style = document.createElement("style");
  style.textContent = `
    #fiveAccountPanel{margin-top:24px;border-top:1px solid var(--line,#d6d2ca);padding-top:22px}
    #fiveAccountPanel .five-account-label{font-size:10px;letter-spacing:.14em;color:var(--muted,#77736c);text-transform:uppercase}
    #fiveAccountPanel .five-account-email{font-size:clamp(18px,4vw,25px);font-weight:600;overflow-wrap:anywhere;margin:12px 0 8px}
    #fiveAccountPanel .five-account-status{font-size:12px;color:var(--muted,#77736c);margin-bottom:22px}
    #fiveAccountPanel .five-account-signout{min-height:54px;width:100%;border:1px solid #111;background:transparent;color:#111;padding:15px 20px;font:11px Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase}
    #fiveAccountPanel .five-account-signout:disabled{opacity:.55}
    #fiveAccountPanel .five-account-message{display:none;margin-top:12px;color:#7a3535;font-size:12px;line-height:1.45}
    #auth.five-is-signed-in .form,
    #auth.five-is-signed-in .auth-actions,
    #auth.five-is-signed-in #fiveSocialAuth,
    #auth.five-is-signed-in #authCopy,
    #auth.five-is-signed-in #authMessage{display:none!important}
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "fiveAccountPanel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="five-account-label">SIGNED IN</div>
    <div class="five-account-email" id="fiveAccountEmail"></div>
    <div class="five-account-status">Your account is active. Your calls are saved to this account.</div>
    <button type="button" class="five-account-signout" id="fiveAccountSignOut">SIGN OUT</button>
    <div class="five-account-message" id="fiveAccountMessage" role="status"></div>
  `;
  authSection.appendChild(panel);

  let client;
  try {
    if (!window.supabase?.createClient || !window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY) {
      throw new Error("Supabase configuration is missing.");
    }
    client = window.supabase.createClient(window.FIVE_SUPABASE_URL, window.FIVE_SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch (e) {
    return;
  }

  const emailEl = document.getElementById("fiveAccountEmail");
  const signOutBtn = document.getElementById("fiveAccountSignOut");
  const messageEl = document.getElementById("fiveAccountMessage");

  function render(session) {
    const user = session?.user;
    const signedIn = !!user;
    authSection.classList.toggle("five-is-signed-in", signedIn);
    panel.hidden = !signedIn;
    if (emailEl) emailEl.textContent = user?.email || "Signed in with a social account";
    const nav = document.getElementById("authNav");
    if (nav) nav.textContent = signedIn ? "ACCOUNT" : "SIGN IN";
    const counter = document.getElementById("counter");
    if (counter) counter.textContent = signedIn ? (user.email || "SIGNED IN") : "SIGNED OUT";

    // Keep the original email form and both social providers available to guests.
    const modeButton = document.getElementById("authModeSwitch");
    const submitButton = document.getElementById("authSubmit");
    if (modeButton) modeButton.classList.toggle("hidden", signedIn);
    if (submitButton) submitButton.classList.toggle("hidden", signedIn);
    const social = document.getElementById("fiveSocialAuth");
    if (social) social.classList.toggle("hidden", signedIn);
    const oldSignOut = document.getElementById("signOutButton");
    if (oldSignOut) oldSignOut.classList.add("hidden");
  }

  async function refresh() {
    const { data, error } = await client.auth.getSession();
    if (!error) render(data.session);
  }

  signOutBtn.addEventListener("click", async () => {
    signOutBtn.disabled = true;
    signOutBtn.textContent = "SIGNING OUT…";
    messageEl.style.display = "none";
    const { error } = await client.auth.signOut();
    if (error) {
      messageEl.textContent = error.message || "Could not sign out. Please try again.";
      messageEl.style.display = "block";
      signOutBtn.disabled = false;
      signOutBtn.textContent = "SIGN OUT";
      return;
    }
    render(null);
    signOutBtn.disabled = false;
    signOutBtn.textContent = "SIGN OUT";
    if (typeof window.home === "function") window.home();
  });

  client.auth.onAuthStateChange((_event, session) => render(session));
  // app.js changes the auth section's hidden class when ACCOUNT is opened.
  const observer = new MutationObserver(() => {
    if (!authSection.classList.contains("hidden")) refresh();
  });
  observer.observe(authSection, { attributes: true, attributeFilter: ["class"] });
  refresh();
})();
