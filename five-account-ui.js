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
    .five-modal-backdrop{
      position:fixed;inset:0;z-index:99999;
      display:flex;align-items:center;justify-content:center;
      padding:22px 18px calc(22px + env(safe-area-inset-bottom));
      background:rgba(16,16,16,.72);backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
      opacity:1;transition:opacity .18s ease;
    }
    .five-modal-backdrop[hidden]{display:none!important}
    .five-modal{
      width:min(100%,430px);max-height:calc(100dvh - 44px);
      overflow:auto;background:#f1efe9;color:#111;
      border:1px solid #c9c5bc;padding:26px 24px 22px;
      box-shadow:0 24px 80px rgba(0,0,0,.24);
      animation:fiveModalIn .2s ease-out;
    }
    @keyframes fiveModalIn{
      from{opacity:0;transform:translateY(12px) scale(.985)}
      to{opacity:1;transform:translateY(0) scale(1)}
    }
    .five-modal .five-modal-kicker{
      display:flex;align-items:center;gap:10px;
      font-size:10px;letter-spacing:.18em;color:#77736c;
      text-transform:uppercase;margin-bottom:24px
    }
    .five-modal .five-modal-kicker:before{
      content:"";display:block;width:24px;height:3px;background:#1685ff
    }
    .five-modal h2{
      font-size:clamp(30px,8vw,42px);line-height:.94;
      letter-spacing:-.055em;margin:0 0 18px;text-transform:uppercase;
      font-weight:800;max-width:330px
    }
    .five-modal p{font-size:14px;line-height:1.55;color:#514f4a;margin:0 0 14px}
    .five-modal .five-modal-warning{
      padding:16px 0;border-top:1px solid #c9c5bc;
      border-bottom:1px solid #c9c5bc;color:#7b3933;
      margin:20px 0;font-size:13px;line-height:1.55
    }
    .five-modal .five-modal-warning:before{
      content:"IMPORTANT";display:block;font-size:9px;letter-spacing:.16em;
      font-weight:700;margin-bottom:8px;color:#7b3933
    }
    .five-modal input{
      width:100%;box-sizing:border-box;background:#f8f7f3;
      border:1px solid #aaa69d;border-radius:0;padding:15px;
      font:16px Arial,sans-serif;margin:8px 0 18px;color:#111;
      outline:none;min-height:52px
    }
    .five-modal input:focus{border-color:#1685ff;box-shadow:0 0 0 1px #1685ff}
    .five-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}
    .five-modal-actions button{
      appearance:none;-webkit-appearance:none;box-sizing:border-box;
      display:flex;align-items:center;justify-content:center;
      width:100%;min-height:54px;padding:14px 10px;
      border:1px solid #111!important;background:transparent;color:#111;
      font-family:Arial,Helvetica,sans-serif;font-size:11px;
      letter-spacing:.12em;text-transform:uppercase;font-weight:600;
      cursor:pointer;border-radius:0!important;box-shadow:none!important
    }
    .five-modal-actions button:disabled{opacity:.5;cursor:wait}
    .five-modal-actions button:first-child{border-radius:0!important}
    .five-modal-actions button:last-child{border-radius:0!important}
    .five-modal-actions .five-modal-danger{background:#8a3e37!important;color:#fff;border-color:#8a3e37!important;border-radius:0!important}
    .five-modal-error{color:#8a3e37;font-size:12px;line-height:1.4;margin:0 0 12px}
    @media(max-width:420px){
      .five-modal{padding:22px 20px 20px}
      .five-modal .five-modal-kicker{margin-bottom:20px}
      .five-modal-actions{grid-template-columns:1fr}
      .five-modal-actions button{min-height:50px}
    }
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

    #fiveAccountPanel .five-account-actions button{border-radius:0!important;min-width:182px}
    #fiveAccountPanel .five-share-progress{border-color:#1685ff!important;color:#1685ff!important}
    .five-achievement-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(12,12,12,.76);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    .five-achievement-backdrop[hidden]{display:none!important}
    .five-achievement-card{position:relative;width:min(100%,410px);box-sizing:border-box;background:#f1efe9;color:#111;border:1px solid #d4d0c7;padding:28px 24px 24px;text-align:left;box-shadow:0 24px 90px #0005}
    .five-achievement-mark{height:112px;display:flex;align-items:center;justify-content:center;margin:0 0 24px;background:#111;color:#1685ff;font-size:46px;font-weight:900;letter-spacing:-.08em;position:relative;overflow:hidden}
    .five-achievement-mark:after{content:"FIVE / LEVEL UP";position:absolute;bottom:12px;left:14px;font-size:9px;letter-spacing:.18em;color:#f1efe9;font-weight:600}
    .five-achievement-card .kicker{font-size:10px;letter-spacing:.18em;color:#77736c;text-transform:uppercase;margin-bottom:16px}
    .five-achievement-card h2{font-size:clamp(32px,8vw,44px);line-height:.92;letter-spacing:-.06em;text-transform:uppercase;margin:0 0 14px}
    .five-achievement-card p{font-size:14px;line-height:1.5;color:#55524c;margin:0 0 20px}
    .five-achievement-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .five-achievement-actions button{border:1px solid #111;border-radius:0!important;background:transparent;color:#111;min-height:50px;padding:12px 10px;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
    .five-achievement-actions button:last-child{background:#111;color:#fff}
    @media(max-width:420px){.five-achievement-actions{grid-template-columns:1fr}.five-achievement-card{padding:22px 20px}}

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
      <p class="five-account-note" id="fiveDailyNote">10 PLAY calls allowed per day.</p>
      <div class="five-account-row"><span>NEXT UNLOCK</span><strong id="homeUnlock">10 calls → YOUR EYE</strong></div>
      <div class="five-account-progress" aria-label="Progress to next unlock"><span id="fiveUnlockProgress"></span></div>
      <div class="five-unlock-status" id="fiveUnlockStatus">First milestone</div>
      <p class="five-account-note" id="fiveUnlockNote">Reach 10 real calls to unlock your personal choice-history summary in YOUR EYE.</p>
    </div>
    <div class="five-account-actions">
      <button type="button" id="fiveShareProgress" class="five-share-progress">SHARE MY LEVEL</button>
      <button type="button" id="fiveAccountSignOut">SIGN OUT</button>
      <button type="button" id="fiveAccountDelete" class="five-delete">DELETE ACCOUNT</button>
    </div>
    <div class="five-account-message" id="fiveAccountMessage" role="status"></div>
  `;
  authSection.appendChild(panel);

  const modal = document.createElement("div");
  modal.className = "five-modal-backdrop";
  modal.hidden = true;
  modal.innerHTML = `
    <section class="five-modal" role="dialog" aria-modal="true" aria-labelledby="fiveDeleteTitle">
      <div class="five-modal-kicker">ACCOUNT CONTROL</div>
      <h2 id="fiveDeleteTitle">Delete account?</h2>
      <p id="fiveDeleteIntro">You are about to permanently delete your FIVE account.</p>
      <div class="five-modal-warning" id="fiveDeleteWarning">Your progress, call history, and unlocked milestones will be permanently lost. Every vote you made will be removed from artists’ totals, so their vote counts and rankings may change.</div>
      <p id="fiveDeleteStep">This cannot be undone.</p>
      <input id="fiveDeleteInput" type="text" autocomplete="off" autocapitalize="characters" placeholder="Type DELETE to confirm" hidden />
      <div class="five-modal-error" id="fiveDeleteError" hidden></div>
      <div class="five-modal-actions">
        <button type="button" id="fiveDeleteCancel">CANCEL</button>
        <button type="button" id="fiveDeleteContinue" class="five-modal-danger">CONTINUE</button>
      </div>
    </section>`;
  document.body.appendChild(modal);

  const achievementModal = document.createElement("div");
  achievementModal.className = "five-achievement-backdrop";
  achievementModal.hidden = true;
  achievementModal.innerHTML = `
    <section class="five-achievement-card" role="dialog" aria-modal="true" aria-labelledby="fiveAchievementTitle">
      <div class="five-achievement-mark" id="fiveAchievementMark">10</div>
      <div class="kicker">ACHIEVEMENT UNLOCKED</div>
      <h2 id="fiveAchievementTitle">YOUR EYE</h2>
      <p id="fiveAchievementCopy">Your choices are becoming a personal signal. Keep exploring to unlock the next level.</p>
      <div class="five-achievement-actions"><button type="button" id="fiveAchievementClose">KEEP EXPLORING</button><button type="button" id="fiveAchievementShare">SHARE ACHIEVEMENT</button></div>
    </section>`;
  document.body.appendChild(achievementModal);

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

  const fiveMilestones = [
    { count: 10, title: "YOUR EYE", copy: "Your first personal signal is unlocked. Your choices are now building a taste profile." },
    { count: 25, title: "EXPLORER SIGNAL", copy: "You are exploring beyond the obvious. Your discovery-breadth signal is unlocked." },
    { count: 50, title: "TASTE PROFILE", copy: "Your history is getting richer. Your repeat-interest signal is unlocked." },
    { count: 100, title: "FIVE INSIDER", copy: "100 real calls. You have built a substantial personal record inside FIVE." },
    { count: 250, title: "COLLECTOR LEVEL", copy: "250 real calls. Your commitment to discovery has reached a new level." },
    { count: 500, title: "FIVE ICON", copy: "500 real calls. Your discovery habit has reached icon level." },
    { count: 1000, title: "TASTE AUTHORITY", copy: "1,000 real calls. Your long-term taste record is taking shape." },
    { count: 3000, title: "CULTURE SHAPER", copy: "3,000 real calls. You have built an extensive discovery history." },
    { count: 5000, title: "FIVE LEGEND", copy: "5,000 real calls. You have reached the highest current FIVE milestone." }
  ];
  let activeAchievement = null;
  function showAchievement(item) {
    activeAchievement = item;
    document.getElementById("fiveAchievementMark").textContent = String(item.count).padStart(2,"0");
    document.getElementById("fiveAchievementTitle").textContent = item.title;
    document.getElementById("fiveAchievementCopy").textContent = item.copy;
    achievementModal.hidden = false;
  }
  document.getElementById("fiveAchievementClose").addEventListener("click", () => { achievementModal.hidden = true; });
  achievementModal.addEventListener("click", event => { if (event.target === achievementModal) achievementModal.hidden = true; });
  document.getElementById("fiveAchievementShare").addEventListener("click", async () => {
    if (activeAchievement) await shareStoryCard({type:"achievement", title:activeAchievement.title, subtitle:`LEVEL ${activeAchievement.count}`, detail:activeAchievement.copy});
  });
  document.getElementById("fiveShareProgress").addEventListener("click", async () => {
    const total = Number(document.getElementById("homeCalls").textContent) || 0;
    const milestone = [...fiveMilestones].reverse().find(item => total >= item.count) || {count:0,title:"FIRST CALL",copy:"Start making real calls to build your personal discovery record."};
    await shareStoryCard({type:"achievement",title:milestone.title,subtitle:`${total} REAL CALLS`,detail:"My discovery history is growing on FIVE."});
  });

  async function shareStoryCard({type="achievement",title="FIVE",subtitle="MY DISCOVERY",detail=""}) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f1efe9"; ctx.fillRect(0,0,1080,1920);
    ctx.fillStyle = "#1685ff"; ctx.fillRect(72,86,120,12);
    ctx.fillStyle = "#111111"; ctx.font = "900 72px Arial"; ctx.fillText("FIVE",72,190);
    ctx.strokeStyle = "#111111"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(72,235); ctx.lineTo(1008,235); ctx.stroke();
    ctx.fillStyle = "#77736c"; ctx.font = "500 28px Arial"; ctx.fillText(type === "artist" ? "MY MOST-CHOSEN ARTIST" : "ACHIEVEMENT UNLOCKED",72,330);
    ctx.fillStyle = "#111111"; ctx.font = "900 92px Arial";
    const words = String(title).toUpperCase().split(" "); let lines=[], line="";
    words.forEach(word=>{const test=line?line+" "+word:word;if(ctx.measureText(test).width>900&&line){lines.push(line);line=word;}else line=test;}); if(line)lines.push(line);
    let y=520; lines.slice(0,3).forEach(text=>{ctx.fillText(text,72,y);y+=104;});
    ctx.fillStyle = "#1685ff"; ctx.font = "700 32px Arial"; ctx.fillText(String(subtitle).toUpperCase(),72,y+32);
    ctx.fillStyle = "#111111"; ctx.fillRect(72,y+88,936,5);
    ctx.fillStyle = "#55524c"; ctx.font = "400 34px Arial";
    const detailWords=String(detail).split(" "); let dline="", dy=y+160;
    detailWords.forEach(word=>{const test=dline?dline+" "+word:word;if(ctx.measureText(test).width>900&&dline){ctx.fillText(dline,72,dy);dy+=48;dline=word;}else dline=test;}); if(dline)ctx.fillText(dline,72,dy);
    ctx.fillStyle = "#111111"; ctx.fillRect(72,1660,936,180);
    ctx.fillStyle = "#f1efe9"; ctx.font = "700 28px Arial"; ctx.fillText("DISCOVER. CHOOSE. RANK.",108,1730);
    ctx.fillStyle = "#1685ff"; ctx.font = "900 46px Arial"; ctx.fillText("FIVE",108,1795);
    ctx.fillStyle = "#77736c"; ctx.font = "400 24px Arial"; ctx.fillText("murtburnerlab.github.io/five",72,1880);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,"image/png"));
    if (!blob) { say("Could not create the share image. Please try again."); return; }
    const file = new File([blob],"five-story.png",{type:"image/png"});
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) await navigator.share({files:[file],title:"My FIVE achievement",text:`${title} — ${subtitle}`});
      else { const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="five-story.png";a.click();URL.revokeObjectURL(a.href);say("Story image saved. Upload it to Instagram Stories.",true); }
    } catch (error) { if(error?.name!=="AbortError") say("Sharing was unavailable. Try again or save the story image."); }
  }

  function renderUnlocks(total, userId) {
    const milestones = [
      { count: 10, title: "YOUR EYE", note: "Unlock your personal choice-history summary and see which artists you choose most often." },
      { count: 25, title: "EXPLORER SIGNAL", note: "Unlock your discovery-breadth percentage in YOUR EYE." },
      { count: 50, title: "TASTE PROFILE", note: "Unlock your repeat-interest rate in YOUR EYE." },
      { count: 100, title: "FIVE INSIDER", note: "Reach the long-term history milestone; your recorded calls remain available in YOUR CALLS." },
      { count: 250, title: "COLLECTOR LEVEL", note: "Reach 250 recorded calls and earn the Collector Level milestone." },
      { count: 500, title: "FIVE ICON", note: "Reach 500 recorded calls and earn the FIVE ICON milestone." },
      { count: 1000, title: "TASTE AUTHORITY", note: "Reach 1,000 recorded calls and earn the TASTE AUTHORITY milestone." },
      { count: 3000, title: "CULTURE SHAPER", note: "Reach 3,000 recorded calls and earn the CULTURE SHAPER milestone." },
      { count: 5000, title: "FIVE LEGEND", note: "Reach 5,000 recorded calls and earn the highest current milestone." }
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
      if (userId) {
        const seenKey = `five-achievements-seen:${userId}`;
        let seen = [];
        try { seen = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch (_) {}
        const fresh = fiveMilestones.filter(item => total >= item.count).find(item => !seen.includes(item.count));
        if (fresh) { seen.push(fresh.count); try { localStorage.setItem(seenKey, JSON.stringify(seen)); } catch (_) {} showAchievement(fresh); }
      }
      return;
    }
    const previous = achieved.length ? achieved[achieved.length - 1].count : 0;
    const percent = Math.max(0, Math.min(100, ((total - previous) / (next.count - previous)) * 100));
    label.textContent = `${next.count} calls → ${next.title}`;
    note.textContent = `${next.count - total} more call${next.count - total === 1 ? "" : "s"} to unlock: ${next.note}`;
    progress.style.width = `${percent}%`;
    if (userId) {
      const unlocked = fiveMilestones.filter(item => total >= item.count);
      const seenKey = `five-achievements-seen:${userId}`;
      let seen = [];
      try { seen = JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch (_) {}
      const fresh = unlocked.find(item => !seen.includes(item.count));
      if (fresh) {
        seen.push(fresh.count);
        try { localStorage.setItem(seenKey, JSON.stringify(seen)); } catch (_) {}
        showAchievement(fresh);
      }
    }
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
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
    const todayCount = playCalls.filter(call => {
      if (!call.created_at) return false;
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date(call.created_at)) === today;
    }).length;
    document.getElementById("homeCalls").textContent = String(total);
    document.getElementById("fiveCallsToday").textContent = `${Math.min(todayCount, 10)} / 10`;
    const dailyNote = document.getElementById("fiveDailyNote");
    if (dailyNote) {
      dailyNote.classList.toggle("warning", todayCount >= 10);
      dailyNote.textContent = todayCount > 10
        ? "Daily limit reached. You can make more PLAY calls tomorrow."
        : todayCount === 10
          ? "Daily limit reached. You can make more PLAY calls tomorrow."
          : `${10 - todayCount} PLAY call${10 - todayCount === 1 ? "" : "s"} remaining today.`;
    }
    renderUnlocks(total, userId);
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

  const modalInput = document.getElementById("fiveDeleteInput");
  const modalError = document.getElementById("fiveDeleteError");
  const modalStep = document.getElementById("fiveDeleteStep");
  const modalIntro = document.getElementById("fiveDeleteIntro");
  const modalTitle = document.getElementById("fiveDeleteTitle");
  const modalContinue = document.getElementById("fiveDeleteContinue");
  const modalCancel = document.getElementById("fiveDeleteCancel");
  let deleteStep = 1;

  function openDeleteModal() {
    deleteStep = 1;
    modalTitle.textContent = "DELETE ACCOUNT?";
    modalIntro.textContent = "This permanently removes your FIVE account and its personal data.";
    modalStep.textContent = "Review the consequences. You will confirm again before deletion starts.";
    modalInput.hidden = true;
    modalInput.value = "";
    modalError.hidden = true;
    modalError.textContent = "";
    modalContinue.disabled = false;
    modalCancel.disabled = false;
    modalContinue.textContent = "CONTINUE";
    modal.hidden = false;
    modalCancel.focus();
  }
  function closeDeleteModal() {
    modal.hidden = true;
    modalInput.value = "";
  }
  modalCancel.addEventListener("click", closeDeleteModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeDeleteModal();
  });
  modalContinue.addEventListener("click", async () => {
    if (deleteStep === 1) {
      deleteStep = 2;
      modalTitle.textContent = "CONFIRM DELETION";
      modalIntro.textContent = "This cannot be undone. Your progress and unlocked milestones will be lost, and removing your votes can change artists’ totals and rankings.";
      modalStep.textContent = "Type DELETE below to confirm. Your votes will be removed from artist totals, which can change rankings.";
      modalInput.hidden = false;
      modalContinue.textContent = "DELETE ACCOUNT";
      modalInput.focus();
      return;
    }
    if (modalInput.value.trim() !== "DELETE") {
      modalError.textContent = "Type DELETE exactly to confirm.";
      modalError.hidden = false;
      return;
    }
    modalContinue.disabled = true;
    modalCancel.disabled = true;
    modalContinue.textContent = "DELETING…";
    modalError.hidden = true;
    deleteBtn.disabled = true;
    signOutBtn.disabled = true;
    try {
      const { error } = await client.rpc("delete_my_account");
      if (error) throw error;
      await client.auth.signOut();
      closeDeleteModal();
      render(null);
      if (typeof window.home === "function") window.home();
      say("Your account and progress were deleted. Your votes were removed from artist totals and rankings may have changed.", true);
    } catch (error) {
      modalError.textContent = "Account was not deleted: " + (error?.message || "Please try again.");
      modalError.hidden = false;
      modalContinue.disabled = false;
      modalCancel.disabled = false;
      modalContinue.textContent = "TRY AGAIN";
      deleteBtn.disabled = false;
      signOutBtn.disabled = false;
    }
  });
  deleteBtn.addEventListener("click", openDeleteModal);

  client.auth.onAuthStateChange((_event, session) => {
    render(session);
    if (session?.user) setTimeout(() => refreshStats(session.user.id), 0);
  });
  window.addEventListener("five:call-recorded", async () => {
    const { data } = await client.auth.getSession();
    if (data.session?.user) await refreshStats(data.session.user.id);
  });
  const observer = new MutationObserver(() => {
    if (!authSection.classList.contains("hidden")) refresh();
  });
  observer.observe(authSection, { attributes: true, attributeFilter: ["class"] });
  refresh();
})();
