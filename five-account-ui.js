/* FIVE account panel — requires index.html to load this file after app.js and five-auth-buttons.js */
(() => {
  const authSection = document.getElementById("auth");
  if (!authSection || document.getElementById("fiveAccountPanel")) return;

  const style = document.createElement("style");
  style.textContent = `
    #fiveAccountPanel{margin-top:22px;border-top:1px solid #111;padding-top:20px}
    #fiveAccountPanel[hidden]{display:none!important}
    #fiveAccountPanel .five-account-summary{margin:24px 0;border:1px solid #d6d2ca;padding:18px}
    #fiveAccountPanel .five-account-row{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:14px 0;border-bottom:1px solid #d6d2ca}
    #fiveAccountPanel .five-account-row span{font-size:10px;letter-spacing:.12em;color:#77736c}
    #fiveAccountPanel .five-account-row strong{font-size:16px;font-weight:500;text-align:right;overflow-wrap:anywhere}
    #fiveAccountPanel .five-account-note{font-size:12px;line-height:1.5;color:#77736c;margin:18px 0 0}
    #fiveAccountPanel .five-account-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#77736c}
    #fiveAccountPanel .five-account-email{font-size:16px;overflow-wrap:anywhere;margin:10px 0 18px}
    #fiveAccountPanel button{min-height:52px;border:1px solid #111;background:transparent;padding:14px 18px;font:10px Arial,Helvetica,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
    #fiveAccountPanel button:disabled{opacity:.55;cursor:wait}
    #fiveAccountPanel .five-account-message{display:none;margin-top:12px;color:#7a3535;font-size:12px;line-height:1.4}
    #auth.five-is-signed-in .form,#auth.five-is-signed-in .auth-actions,#auth.five-is-signed-in #fiveSocialAuth,#auth.five-is-signed-in #authCopy{display:none!important}
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "fiveAccountPanel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="five-account-label">SIGNED IN</div>
    <div class="five-account-email" id="fiveAccountEmail"></div>
    <div class="five-account-summary">
      <div class="five-account-row"><span>YOUR CALLS</span><strong id="homeCalls">0</strong></div>
      <div class="five-account-row"><span>ACTIVE CALLS</span><strong id="homeActive">0</strong></div>
      <div class="five-account-row"><span>NEXT UNLOCK</span><strong id="homeUnlock">10 calls → YOUR EYE</strong></div>
      <div class="five-account-row"><span>DAILY FIVE</span><strong>Available</strong></div>
      <p class="five-account-note">Your scores are based on your choices inside FIVE. This prototype uses simulated artist movement; production data will come from real user choices.</p>
    </div>
    <button type="button" id="fiveAccountSignOut">SIGN OUT</button>
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
    const title = document.getElementById("authTitle");
    if (title) title.textContent = signedIn ? "ACCOUNT" : "SIGN IN";
    const counter = document.getElementById("counter");
    if (counter) counter.textContent = signedIn ? (user.email || "SIGNED IN") : "SIGNED OUT";

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
  const observer = new MutationObserver(() => {
    if (!authSection.classList.contains("hidden")) refresh();
  });
  observer.observe(authSection, { attributes: true, attributeFilter: ["class"] });
  refresh();
})();
