/* FIVE engagement improvements: truthful CALLS history and a frictionless next choice.
   Existing authentication, vote submission, database and ranking logic remain untouched. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!window.supabase?.createClient || !window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY) return;

  const client = window.supabase.createClient(window.FIVE_SUPABASE_URL, window.FIVE_SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const style = document.createElement("style");
  style.textContent = `
    #calls .calls-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:18px 0;border-bottom:1px solid #d6d2ca;margin-bottom:4px}
    #calls .calls-intro strong{font-size:clamp(24px,5vw,40px);letter-spacing:-.06em}
    #calls .calls-intro span{font-size:10px;color:#77736c;letter-spacing:.1em;text-transform:uppercase}
    #calls .call-card{grid-template-columns:52px minmax(0,1fr) minmax(90px,140px);gap:14px;padding:18px 0}
    #calls .call-index{font-size:12px;color:#77736c}
    #calls .call-status{font-size:10px;text-align:right;color:#1685ff;letter-spacing:.08em}
    #calls .call-data-note{font-size:11px;color:#77736c;line-height:1.5;margin:20px 0}
    #calls .calls-next{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:22px 0;border-top:1px solid #111;margin-top:26px}
    #calls .calls-next h3{font-size:clamp(24px,5vw,38px);letter-spacing:-.06em;margin:0 0 7px}
    #calls .calls-next p{font-size:12px;line-height:1.5;color:#77736c;margin:0;max-width:360px}
    #calls .calls-next button{flex-shrink:0}
    @media(max-width:520px){#calls .call-card{grid-template-columns:36px minmax(0,1fr);gap:10px}#calls .call-status{grid-column:2;text-align:left}#calls .calls-next{align-items:flex-start;flex-direction:column}#calls .calls-next button{width:100%}}
  `;
  document.head.appendChild(style);

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }

  async function renderCallsEnhanced() {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      if (typeof window.authView === "function") window.authView("Sign in to see your calls.");
      return;
    }
    const userId = sessionData.session.user.id;
    const list = $("callsList");
    const label = $("activeLabel");
    const note = $("callsMessage");
    if (!list) return;
    list.innerHTML = `<div class="report"><h3>Loading your history…</h3></div>`;

    const { data, error } = await client.from("calls")
      .select("id,created_at,rank_at_choice,artist_id,mode,artists(id,name,country)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      list.innerHTML = `<div class="report"><h3>History unavailable.</h3><div class="small">${escape(error.message)}</div></div>`;
      return;
    }

    const calls = (data || []).filter(call => !call.mode || call.mode === "play");
    if (label) label.textContent = `${calls.length} CALL${calls.length === 1 ? "" : "S"}`;
    if (!calls.length) {
      list.innerHTML = `
        <div class="report"><h3>Your history starts with one choice.</h3>
        <div class="small">Make your first call. Each saved decision will appear here.</div></div>
        <div class="calls-next"><div><h3>READY FOR YOUR NEXT CALL?</h3><p>Five artists. One choice. Your history grows with every real decision.</p></div>
        <button class="primary" type="button" id="fiveCallsNext">MAKE YOUR FIRST CALL</button></div>`;
    } else {
      list.innerHTML = `
        <div class="calls-intro"><div><span>YOUR DECISIONS</span><br><strong>${calls.length.toLocaleString()} real call${calls.length===1?"":"s"}</strong></div><span>Newest first</span></div>
        ${calls.map((call,index) => {
          const artist = call.artists || {};
          const date = call.created_at ? new Date(call.created_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}) : "Date unavailable";
          const slot = Number.isInteger(call.rank_at_choice) ? `ROUND POSITION ${call.rank_at_choice}` : "CALL RECORDED";
          return `<article class="call-card">
            <div class="call-index">#${String(calls.length-index).padStart(3,"0")}</div>
            <div><div class="call-name">${escape(artist.name || "Artist")}</div>
            <div class="call-country">${escape(artist.country || "Country not listed")} · ${escape(date)}</div></div>
            <div class="call-status">${escape(slot)}</div>
          </article>`;
        }).join("")}
        <p class="call-data-note">This is your real saved call history. FIVE only displays ranking movement when it can verify the relevant data; it does not invent past positions.</p>
        <div class="calls-next"><div><h3>YOUR NEXT CALL</h3><p>Every new choice adds another decision to your history. Keep discovering.</p></div>
        <button class="primary" type="button" id="fiveCallsNext">MAKE ANOTHER CHOICE</button></div>`;
    }
    $("fiveCallsNext")?.addEventListener("click", () => {
      if (typeof window.play === "function") window.play();
    });
    if (note) {
      note.textContent = "";
      note.classList.add("hidden");
    }
  }

  // Keep existing navigation entry point but replace only the CALLS renderer.
  window.viewCalls = function () {
    if (typeof window.show === "function") window.show("calls");
    renderCallsEnhanced().catch(error => console.error("FIVE CALLS history:", error));
  };

  // Existing app functions may call renderCalls directly.
  window.renderCalls = function () {
    renderCallsEnhanced().catch(error => console.error("FIVE CALLS history:", error));
  };

  // Make the result-screen action explicit, while preserving its current behavior.
  const resultAction = document.querySelector("#result .result-actions .primary");
  if (resultAction) {
    resultAction.textContent = "MAKE ANOTHER CHOICE";
    resultAction.setAttribute("aria-label", "Continue to the next five artists");
  }
})();
