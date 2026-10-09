/* FIVE account panel — load after app.js and five-auth-buttons.js. */
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
    #fiveAccountPanel .five-account-progress{height:4px;background:#d6d2ca;margin-top:10px}
    #fiveAccountPanel .five-account-progress span{display:block;height:4px;background:#1685ff;width:0}
    #fiveAccountPanel .five-account-actions{display:flex;flex-direction:column;align-items:flex-start;gap:12px;margin-top:22px}
    #fiveAccountPanel button{min-height:52px;border:1px solid #111;background:transparent;padding:14px 18px;font:10px Arial,Helvetica,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
    #fiveAccountPanel button:disabled{opacity:.55;cursor:wait}
    #fiveAccountPanel .five-delete{border-color:#7a3535;color:#7a3535}
    #fiveAccountPanel .five-account-message{display:none;margin-top:12px;color:#7a3535;font-size:12px;line-height:1.4;overflow-wrap:anywhere}
    #fiveAccountPanel .five-account-message.success{color:#1f5d43}
    #auth.five-is-signed-in .form,#auth.five-is-signed-in .auth-actions,#auth.five-is-signed-in #fiveSocialAuth,#auth.five-is-signed-in #authCopy{display:none!important}
    @media(max-width:420px){#fiveAccountPanel .five-account-row strong{max-width:58%;font-size:15px}}
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
      <div class="five-account-row"><span>CALLS TODAY</span><strong id="fiveCallsToday">0 / 10</strong></div>
      <div class="five-account-row"><span>NEXT UNLOCK</span><strong id="homeUnlock">10 calls → YOUR EYE</strong></div>
      <div class="five-account-progress" aria-label="Progress to next unlock"><span id="fiveUnlockProgress"></span></div>
      <p class="five-account-note" id="fiveUnlockNote">Every real call moves you toward the next milestone.</p>
      <div class="five-account-row"><span>DAILY FIVE</span><strong>Daily challenge</strong></div>
      <p class="five-account-note">A daily set of five artists, designed to make discovery a habit. The challenge is not active yet; it does not give extra votes or bypass the 10-call daily limit.</p>
    </div>
    <div class="five-account-actions">
      <button type="button" id="fiveAccountSignOut">SIGN OUT</button>
      <button type="button" id="fiveAccountDelete" class="five-delete">DELETE ACCOUNT</button>
    </div>
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
  } catch (_) { return; }

  const emailEl = document.getElementById("fiveAccountEmail");
  const signOutBtn = document.getElementById("fiveAccountSignOut");
  const deleteBtn = document.getElementById("fiveAccountDelete");
  const messageEl = document.getElementById("fiveAccountMessage");

  function say(text, success = false) {
    messageEl.textContent = text || "";
    messageEl.classList.toggle("success", !!success);
    messageEl.style.display = text ? "block" : "none";
  }

  function renderUnlocks(total) {
    const milestones = [
      { count: 10, title: "YOUR EYE", note: "First milestone: your personal choice history." },
      { count: 25, title: "EXPLORER SIGNAL", note: "Next milestone: a broader discovery profile." },
      { count: 50, title: "TASTE PROFILE", note: "Next milestone: a more detailed picture of your preferences." },
      { count: 100, title: "FIVE INSIDER", note: "Next milestone: your long-term discovery profile." },
      { count: 250, title: "COLLECTOR LEVEL", note: "You have reached the current milestone track." }
    ];
    const next = milestones.find(item => total < item.count);
    const label = document.getElementById("homeUnlock");
    const note = document.getElementById("fiveUnlockNote");
    const progress = document.getElementById("fiveUnlockProgress");
    if (!next) {
      label.textContent = "All current milestones reached";
      note.textContent = "You have completed the current milestone track. More levels can be added as FIVE develops.";
      progress.style.width = "100%";
      return;
    }
    const previous = milestones[milestones.indexOf(next) - 1]?.count || 0;
    const percent = Math.max(0, Math.min(100, ((total - previous) / (next.count - previous)) * 100));
    label.textContent = `${next.count} calls → ${next.title}`;
    note.textContent = `${next.count - total} more call${next.count - total === 1 ? "" : "s"} to the next milestone.`;
    progress.style.width = `${percent}%`;
  }

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
    ["authModeSwitch", "authSubmit", "fiveSocialAuth"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("hidden", signedIn);
    });
    const oldSignOut = document.getElementById("signOutButton");
    if (oldSignOut) oldSignOut.classList.add("hidden");
  }

  async function refreshStats(userId) {
    const { data, error } = await client.from("calls")
      .select("id,created_at,mode")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      say("Could not load your call history: " + error.message);
      return;
    }
    const calls = data || [];
    const playCalls = calls.filter(call => !call.mode || call.mode === "play");
    const total = playCalls.length;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
    const todayCount = playCalls.filter(call => {
      if (!call.created_at) return false;
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(call.created_at)) === today;
    }).length;
    document.getElementById("homeCalls").textContent = String(total);
    document.getElementById("fiveCallsToday").textContent = `${todayCount} / 10`;
    renderUnlocks(total);
  }

  async function refresh() {
    const { data, error } = await client.auth.getSession();
    if (error) return;
    render(data.session);
    if (data.session?.user) await refreshStats(data.session.user.id);
  }

  signOutBtn.addEventListener("click", async () => {
    signOutBtn.disabled = true;
    signOutBtn.textContent = "SIGNING OUT…";
    say("");
    const { error } = await client.auth.signOut();
    if (error) {
      say(error.message || "Could not sign out. Please try again.");
      signOutBtn.disabled = false;
      signOutBtn.textContent = "SIGN OUT";
      return;
    }
    render(null);
    signOutBtn.disabled = false;
    signOutBtn.textContent = "SIGN OUT";
    if (typeof window.home === "function") window.home();
  });

  deleteBtn.addEventListener("click", async () => {
    const first = window.confirm("Delete your FIVE account permanently? Your account, call history, and artist submissions will be deleted. This cannot be undone.");
    if (!first) return;
    const confirmation = window.prompt('To confirm permanent deletion, type DELETE');
    if (confirmation !== "DELETE") {
      say("Account deletion cancelled. The confirmation text did not match.");
      return;
    }
    deleteBtn.disabled = true;
    signOutBtn.disabled = true;
    deleteBtn.textContent = "DELETING…";
    say("");
    const { error } = await client.rpc("delete_my_account");
    if (error) {
      say("Account was not deleted: " + error.message);
      deleteBtn.disabled = false;
      signOutBtn.disabled = false;
      deleteBtn.textContent = "DELETE ACCOUNT";
      return;
    }
    await client.auth.signOut();
    render(null);
    say("Your account and associated data have been deleted.", true);
    deleteBtn.disabled = false;
    signOutBtn.disabled = false;
    deleteBtn.textContent = "DELETE ACCOUNT";
    if (typeof window.home === "function") window.home();
  });

  client.auth.onAuthStateChange((_event, session) => {
    render(session);
    if (session?.user) setTimeout(() => refreshStats(session.user.id), 0);
  });
  const observer = new MutationObserver(() => {
    if (!authSection.classList.contains("hidden")) refresh();
  });
  observer.observe(authSection, { attributes: true, attributeFilter: ["class"] });
  refresh();
})();
