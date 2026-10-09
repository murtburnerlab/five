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
    #fiveAccountPanel .five-account-note.warning{color:#7a3535}
    #fiveAccountPanel .five-unlock-status{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#1685ff;margin-top:14px}
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
      <p class="five-account-note" id="fiveDailyNote">Daily limit: 10 recorded PLAY votes per Kyiv calendar day.</p>
      <div class="five-account-row"><span>NEXT UNLOCK</span><strong id="homeUnlock">10 calls → YOUR EYE</strong></div>
      <div class="five-account-progress" aria-label="Progress to next unlock"><span id="fiveUnlockProgress"></span></div>
      <div class="five-unlock-status" id="fiveUnlockStatus">First milestone</div>
      <p class="five-account-note" id="fiveUnlockNote">Reach 10 real calls to unlock your personal choice-history summary in YOUR EYE.</p>
      <div class="five-account-row"><span>DAILY FIVE</span><strong>Not active yet</strong></div>
      <p class="five-account-note">DAILY FIVE is planned as a daily set of five artists. It is not playable yet, gives no extra votes, and does not bypass the 10-call daily limit.</p>
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
      { count: 10, title: "YOUR EYE", note: "Unlock your personal choice-history summary and see which artists you choose most often." },
      { count: 25, title: "EXPLORER SIGNAL", note: "Unlock your discovery-breadth percentage in YOUR EYE." },
      { count: 50, title: "TASTE PROFILE", note: "Unlock your repeat-interest rate in YOUR EYE." },
      { count: 100, title: "FIVE INSIDER", note: "Reach the long-term history milestone; your recorded calls remain available in YOUR CALLS." },
      { count: 250, title: "COLLECTOR LEVEL", note: "Reach 250 recorded calls. This is a milestone badge only; no extra votes or unbuilt benefits are promised." }
    ];
    const label = document.getElementById("homeUnlock");
    const note = document.getElementById("fiveUnlockNote");
    const progress = document.getElementById("fiveUnlockProgress");
    const status = document.getElementById("fiveUnlockStatus");
    const achieved = milestones.filter(item => total >= item.count);
    const next = milestones.find(item => total < item.count);
    status.textContent = achieved.length ? `Unlocked: ${achieved[achieved.length - 1].title}` : "No milestones unlocked yet";
    if (!next) {
      label.textContent = "All milestones reached";
      note.textContent = "You have reached all currently defined milestones.";
      progress.style.width = "100%";
      return;
    }
    const previous = achieved.length ? achieved[achieved.length - 1].count : 0;
    const percent = Math.max(0, Math.min(100, ((total - previous) / (next.count - previous)) * 100));
    label.textContent = `${next.count} calls → ${next.title}`;
    note.textContent = `${next.count - total} more call${next.count - total === 1 ? "" : "s"} to unlock: ${next.note}`;
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
      document.getElementById("homeCalls").textContent = "—";
      document.getElementById("fiveCallsToday").textContent = "— / 10";
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
    document.getElementById("fiveCallsToday").textContent = `${Math.min(todayCount, 10)} / 10`;
    const dailyNote = document.getElementById("fiveDailyNote");
    if (dailyNote) {
      dailyNote.classList.toggle("warning", todayCount >= 10);
      dailyNote.textContent = todayCount > 10
        ? "Daily limit reached. Your older history contains more than 10 calls today; new PLAY calls stay blocked until the Kyiv calendar day resets."
        : todayCount === 10
          ? "Daily limit reached. You can make more PLAY calls after the Kyiv calendar day resets."
          : `${10 - todayCount} PLAY call${todayCount === 9 ? "" : "s"} remaining today (Kyiv time).`;
    }
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
