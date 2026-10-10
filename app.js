const supabaseClient = window.supabase.createClient(
  window.FIVE_SUPABASE_URL,
  window.FIVE_SUPABASE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const $ = id => document.getElementById(id);
const views = ["home","auth","play","result","calls","eye","daily","rankings","submit","admin"];

let currentSession = null;
let authMode = "signin";
let currentRound = null;
let myCalls = [];
let busy = false;
let callsLoading = false;
let isFiveAdmin = false;
let adminBusy = false;
let adminArtistRows = [];
let adminSubmissionRows = [];
let adminSubmissionPage = 1, adminSubmissionTotal = 0;
let adminArtistPage = 1, adminArtistTotal = 0;
const ADMIN_PAGE_SIZE = 20;
let rankingPage = 1;
const RANKING_PAGE_SIZE = 30;
function fiveVisitorId(){try{let id=localStorage.getItem("five_visitor_id");if(!id){id=crypto.randomUUID?crypto.randomUUID():"v-"+Date.now()+Math.random().toString(36).slice(2);localStorage.setItem("five_visitor_id",id)}return id}catch(_){return "v-"+Date.now()+Math.random().toString(36).slice(2)}}
function trackEvent(type){try{supabaseClient.rpc("five_track_event",{p_event_type:type,p_visitor_id:fiveVisitorId(),p_path:location.pathname}).then(({error})=>{if(error)console.warn("FIVE analytics failed",error.message)})}catch(_){}}

function show(id) {
  views.forEach(v => $(v)?.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
  closeProfile();
}

function message(id, text, type = "") {
  const el = $(id);
  if (!el) return;
  const originalText = String(text || "");
  const displayText = /daily limit/i.test(originalText) && /new york|calendar day/i.test(originalText)
    ? "Daily limit reached. You can make up to 10 calls per day. Try again tomorrow."
    : originalText;
  el.textContent = displayText;
  el.className = "message" + (type ? " " + type : "");
  el.classList.toggle("hidden", !displayText);
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function url(v) {
  const s = String(v || "").trim();
  return s ? (/^https?:\/\//i.test(s) ? s : "https://" + s) : "";
}

function normalizeInstagram(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const username = raw.replace(/^@/, "");
  if (/^[A-Za-z0-9._]{1,30}$/.test(username) && !/instagram\.com/i.test(username)) {
    return `https://www.instagram.com/${username}/`;
  }
  const normalized = url(raw);
  try {
    const parsed = new URL(normalized);
    if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return "";
    return `https://www.instagram.com/${parsed.pathname.replace(/^\/+|\/+$/g, "")}/`;
  } catch (_) { return ""; }
}

function signedIn() {
  return !!currentSession?.user;
}

function setButton(id, disabled, text) {
  const b = $(id);
  if (!b) return;
  if (!b.dataset.original) b.dataset.original = b.textContent;
  b.disabled = disabled;
  b.textContent = disabled ? text : b.dataset.original;
}

function playCallCount(calls = myCalls) {
  return calls.filter(c => (c.mode || "play") === "play").length;
}

function updateAuthUI() {
  const ok = signedIn();
  if ($("authNav")) $("authNav").textContent = ok ? "ACCOUNT" : "SIGN IN";
  if ($("counter")) $("counter").textContent = ok ? (currentSession.user.email || "SIGNED IN") : "SIGNED OUT";
  if ($("homeAuth")) $("homeAuth").textContent = ok ? (currentSession.user.email || "Signed in") : "Signed out";
  if ($("homeCalls")) $("homeCalls").textContent = ok ? String(playCallCount()) : "Sign in";
  if ($("homeActive")) $("homeActive").textContent = ok ? "0" : "—";
  if ($("homeUnlock")) {
    const count = playCallCount();
    const next = [10,25,50,100,250,500,1000,3000,5000].find(n => count < n);
    $("homeUnlock").textContent = next ? `${next-count} calls → ${({
      10:"YOUR EYE",25:"EXPLORER SIGNAL",50:"TASTE PROFILE",100:"FIVE INSIDER",
      250:"COLLECTOR LEVEL",500:"FIVE ICON",1000:"TASTE AUTHORITY",
      3000:"CULTURE SHAPER",5000:"FIVE LEGEND"
    })[next]}` : "All milestones reached";
  }
  if ($("signOutButton")) $("signOutButton").classList.toggle("hidden", !ok);
  if ($("authPassword")) $("authPassword").disabled = ok;
  if ($("authSubmit")) $("authSubmit").disabled = ok;
}

function authView(text = "") {
  show("auth");
  updateAuthUI();
  message("authMessage", text);
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("authTitle").textContent = signup ? "CREATE ACCOUNT" : "SIGN IN";
  $("authCopy").textContent = signup
    ? "Create an account to start building your record."
    : "Sign in to make calls, submit artists, and build your record.";
  $("authSubmit").textContent = signup ? "CREATE ACCOUNT" : "SIGN IN";
  $("authPassword").disabled = false;
  $("authSubmit").disabled = false;
  message("authMessage", "");
}

async function submitAuth() {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  if (!email || !password) return message("authMessage", "Enter an email and password.", "error");

  setButton("authSubmit", true, authMode === "signup" ? "CREATING..." : "SIGNING IN...");
  const signupAttempt = authMode === "signup";
  const result = signupAttempt
    ? await supabaseClient.auth.signUp({ email, password })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  if (!result.error) trackEvent(signupAttempt ? "account_signup" : "account_login");
  setButton("authSubmit", false);

  if (result.error) return message("authMessage", result.error.message, "error");

  currentSession = result.data.session || currentSession;
  if (authMode === "signup" && !currentSession) {
    return message("authMessage", "Account created. Check your email to confirm your address, then sign in.", "success");
  }

  await loadMyCalls();
  updateAuthUI();
  home();
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) return message("authMessage", error.message, "error");
  currentSession = null;
  myCalls = [];
  currentRound = null;
  home();
}

function home() {
  show("home");
  updateAuthUI();
  loadHomeData();
}

async function loadHomeData() {
  const list = $("homeTopFive");
  const artistsEl = $("globalArtists");
  const choicesEl = $("globalChoices");

  if (list) list.innerHTML = `<div class="small">Loading live ranking…</div>`;

  // Global counters use a dedicated public RPC so they do not depend on
  // the ranking rows being returned or on the ranking request succeeding.
  const statsRequest = supabaseClient.rpc("get_public_stats")
    .then(({ data, error }) => {
      if (error) throw error;
      const stats = Array.isArray(data) ? data[0] : data;
      if (artistsEl) artistsEl.textContent = String(stats?.approved_artists ?? 0);
      if (choicesEl) choicesEl.textContent = String(stats?.total_choices ?? 0);
    })
    .catch(error => {
      if (artistsEl) artistsEl.textContent = "—";
      if (choicesEl) choicesEl.textContent = "—";
      console.error("Could not load FIVE global stats:", error);
    });

  try {
    const { data, error } = await supabaseClient.rpc("get_public_rankings");
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];

    if (!list) {
      await statsRequest;
      return;
    }

    if (!rows.length) {
      list.innerHTML = `<div class="small" style="padding:15px 0">No public calls recorded yet.</div>`;
      await statsRequest;
      return;
    }

    list.innerHTML = rows.slice(0, 5).map((row, i) => `
      <div class="home-rank-row">
        <div class="home-rank-num">#${escapeHtml(row.rank ?? i + 1)}</div>
        <div><div class="home-rank-name">${escapeHtml(row.name || "Artist")}</div>
        <div class="home-rank-country">${escapeHtml(row.country || "Country not listed")}</div></div>
        <div class="home-rank-choices">${Number(row.choices || 0)} choices</div>
      </div>`).join("");
  } catch (error) {
    if (list) list.innerHTML = `<div class="small" style="padding:15px 0">Ranking unavailable. ${escapeHtml(error?.message || "Please refresh.")}</div>`;
  }

  await statsRequest;
}

function normalizeArtist(row, roundId) {
  return {
    id: row.artist_id || row.id,
    roundId: row.round_id || roundId,
    name: row.name || "Untitled artist",
    country: row.country || "",
    instagramUrl: row.instagram_url || "",
  };
}

function normalizeRound(data) {
  const rows = Array.isArray(data) ? data : (data?.artists || data?.items || data?.round_artists || []);
  const roundId = data?.round_id || data?.id || rows[0]?.round_id || null;
  return {
    roundId,
    artists: rows.map(r => normalizeArtist(r, roundId)).filter(a => a.id)
  };
}

async function play() {
  if (!signedIn()) return authView("Sign in to make a call.");
  trackEvent("play_round");
  show("play");
  await newRound();
}

async function newRound() {
  if (busy) return;
  busy = true;
  $("grid").innerHTML = "";
  $("roundLabel").textContent = "LOADING";
  message("playMessage", "Loading five artists...");

  const { data, error } = await supabaseClient.rpc("create_play_round", { p_mode: "play" });
  busy = false;

  if (error) {
    $("roundLabel").textContent = "LIMIT REACHED";
    const rawMessage = String(error.message || "Please try again tomorrow.").replace(/\s{2,}/g, " ");
    const safeMessage = /daily limit|new york|calendar day/i.test(rawMessage)
      ? "Daily limit reached. You can make up to 10 calls per day. Try again tomorrow."
      : rawMessage;
    return message("playMessage", safeMessage, "error");
  }

  currentRound = normalizeRound(data);
  if (!currentRound.roundId || currentRound.artists.length !== 5) {
    $("roundLabel").textContent = "ERROR";
    currentRound = null;
    return message("playMessage", "The server did not return exactly five artists.", "error");
  }

  $("roundLabel").textContent = "SERVER ROUND";
  message("playMessage", "");
  renderRound();
}

function renderRound() {
  $("grid").innerHTML = currentRound.artists.map((a, i) => {
    const instagram = url(a.instagramUrl);
    return `
      <article class="card">
        <div class="number">0${i + 1}</div>
        <div class="card-content">
          <div class="name">${escapeHtml(a.name)}</div>
          <div class="country">${escapeHtml(a.country || "Country not listed")}</div>
        </div>
        <div class="card-actions">
          ${instagram
            ? `<a class="profile" href="${escapeHtml(instagram)}" target="_blank" rel="noopener">INSTAGRAM</a>`
            : `<span class="profile profile-disabled" aria-disabled="true">INSTAGRAM</span>`}
          <button class="choose" onclick="choose(${i})">CHOOSE</button>
        </div>
      </article>`;
  }).join("");
}

async function choose(i) {
  const a = currentRound?.artists[i];
  if (!a || busy) return;
  busy = true;
  document.querySelectorAll(".choose").forEach(b => b.disabled = true);
  message("playMessage", "Recording your call...");

  const { error } = await supabaseClient.rpc("record_call", {
    p_round_id: currentRound.roundId,
    p_artist_id: a.id,
    p_rank_at_choice: null
  });

  if (error) {
    busy = false;
    document.querySelectorAll(".choose").forEach(b => b.disabled = false);
    return message("playMessage", error.message, "error");
  }

  $("chosen").textContent = a.name;
  $("chosenMeta").textContent = a.country || "Country not listed";
  $("resultRank").textContent = "RECORDED";
  $("resultStatus").textContent = "SAVED";

  await loadMyCalls();
  window.dispatchEvent(new CustomEvent("five:call-recorded"));
  busy = false;
  show("result");
  updateAuthUI();
}

function nextRound() { play(); }

async function loadMyCalls() {
  if (!signedIn() || callsLoading) {
    if (!signedIn()) myCalls = [];
    return;
  }
  callsLoading = true;
  try {
    const pageSize = 500;
    let offset = 0;
    const all = [];
    while (true) {
      const { data, error } = await supabaseClient
        .from("calls")
        .select("id,created_at,rank_at_choice,artist_id,mode,artists(id,name,country,instagram_url,website_url)")
        .eq("user_id", currentSession.user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) {
        myCalls = [];
        message("callsMessage", "Could not load your complete call history: " + error.message, "error");
        return;
      }
      const batch = data || [];
      all.push(...batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
    }
    myCalls = all;
    updateAuthUI();
  } finally {
    callsLoading = false;
  }
}

function viewCalls() {
  if (!signedIn()) return authView("Sign in to see your calls.");
  show("calls");
  renderCalls();
}

function renderCalls() {
  $("activeLabel").textContent = `${myCalls.length} CALL${myCalls.length === 1 ? "" : "S"}`;
  message("callsMessage", "");

  if (!myCalls.length) {
    $("callsList").innerHTML = `<div class="report"><h3>No calls yet.</h3><div class="small">Make your first call to start building a real history.</div></div>`;
    return;
  }

  $("callsList").innerHTML = myCalls.map(c => {
    const a = c.artists || {};
    const d = c.created_at ? new Date(c.created_at).toLocaleDateString() : "";
    return `<div class="call-card">
      <div class="rank-old">—</div>
      <div><div class="call-name">${escapeHtml(a.name || "Artist")}</div>
      <div class="call-country">${escapeHtml(a.country || "Country not listed")} · ${escapeHtml(d)}</div></div>
      <div class="rank-now developing">RECORDED</div>
    </div>`;
  }).join("");
}

function eye() {
  if (!signedIn()) return authView("Sign in to build YOUR EYE.");
  show("eye");
  renderEye();
}

function renderEye() {
  const playCalls = myCalls.filter(call => (call.mode || "play") === "play");
  const n = playCalls.length;
  $("eyeCount").textContent = `${n} REAL CALL${n === 1 ? "" : "S"}`;
  const milestones = [
    {count:10,title:"YOUR EYE",copy:"Personal choice-history summary unlocked."},
    {count:25,title:"EXPLORER SIGNAL",copy:"Discovery-breadth signal unlocked."},
    {count:50,title:"TASTE PROFILE",copy:"Repeat-interest signal unlocked."},
    {count:100,title:"FIVE INSIDER",copy:"Long-term history milestone unlocked."},
    {count:250,title:"COLLECTOR LEVEL",copy:"250-call milestone reached."},
    {count:500,title:"FIVE ICON",copy:"500 real calls. Your discovery habit has reached icon level."},
    {count:1000,title:"TASTE AUTHORITY",copy:"1,000 real calls. Your long-term taste record is taking shape."},
    {count:3000,title:"CULTURE SHAPER",copy:"3,000 real calls. You have built an extensive discovery history."},
    {count:5000,title:"FIVE LEGEND",copy:"5,000 real calls. You have reached the highest current FIVE milestone."}
  ];
  const reached = [...milestones].reverse().find(m=>n>=m.count);
  const next = milestones.find(m=>n<m.count);
  const levelTitle = $("eyeLevelTitle"), levelCopy = $("eyeLevelCopy"), levelProgress = $("eyeLevelProgress");
  if (levelTitle && levelCopy && levelProgress) {
    levelTitle.textContent = reached ? reached.title : "FIRST CALL";
    levelCopy.textContent = reached
      ? `${reached.copy} ${next ? `${next.count-n} more calls to unlock ${next.title}.` : "All current milestones reached."}`
      : `${10-n} more calls to unlock YOUR EYE.`;
    const previous = reached?.count || 0;
    const target = next?.count || (reached?.count || 10);
    levelProgress.style.width = `${next ? Math.max(0,Math.min(100,(n-previous)/(target-previous)*100)) : 100}%`;
  }
  $("eyeHeadline").textContent = n < 10 ? "Your eye is starting to form." : "Your history is now measurable.";
  $("eyeCopy").textContent = n < 10
    ? `Make ${10-n} more call${10-n === 1 ? "" : "s"} to unlock the first real signal.`
    : "Your actual choices are recorded. Taste signals will become more reliable as the ranking accumulates real votes.";

  const counts = new Map();
  playCalls.forEach(call => {
    const artist = call.artists || {};
    const id = call.artist_id;
    if (!id) return;
    const current = counts.get(id) || { name: artist.name || "Artist", country: artist.country || "", count: 0 };
    current.count += 1;
    counts.set(id, current);
  });
  const preferences = [...counts.values()].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  const uniqueArtists = preferences.length;
  const repeatedVotes = preferences.reduce((sum, artist) => sum + Math.max(0, artist.count - 1), 0);
  const explorerRate = n ? Math.round(uniqueArtists / n * 100) : 0;
  const repeatRate = n ? Math.round(repeatedVotes / n * 100) : 0;

  const metricCards = [
    {count:10, name:"YOUR EYE", value:`${uniqueArtists} artists`, copy:`Your personal choice history across ${n} recorded calls.`},
    {count:25, name:"EXPLORER SIGNAL", value:`${explorerRate}%`, copy:`Discovery breadth: ${uniqueArtists} different artists across ${n} calls.`},
    {count:50, name:"TASTE PROFILE", value:`${repeatRate}%`, copy:"Repeat-interest rate: the share of calls beyond your first choice of each artist."},
    {count:100, name:"FIVE INSIDER", value:`${n} calls`, copy:"Long-term history milestone reached. Your recorded calls remain available in YOUR CALLS."},
    {count:250, name:"COLLECTOR LEVEL", value:`${n} / 250`, copy:"Milestone rank for building a long-term discovery record."},
    {count:500, name:"FIVE ICON", value:`${n} / 500`, copy:"Milestone rank for sustained participation in FIVE."},
    {count:1000, name:"TASTE AUTHORITY", value:`${n} / 1,000`, copy:"Milestone rank for an extensive personal choice history."},
    {count:3000, name:"CULTURE SHAPER", value:`${n} / 3,000`, copy:"Milestone rank for a substantial discovery history."},
    {count:5000, name:"FIVE LEGEND", value:`${n} / 5,000`, copy:"The highest currently defined FIVE milestone."}
  ];
  $("metrics").innerHTML = metricCards.map(metric => {
    const unlocked = n >= metric.count;
    const value = unlocked ? metric.value : `${metric.count-n} to go`;
    const name = unlocked ? metric.name : `${metric.name} · LOCKED`;
    const copy = unlocked ? metric.copy : `Reach ${metric.count} real calls to unlock this feature.`;
    return `<div class="metric"><div class="metric-name">${escapeHtml(name)}</div>
      <div class="metric-num">${escapeHtml(value)}</div>
      <div class="metric-copy">${escapeHtml(copy)}</div></div>`;
  }).join("");

  $("fiveList").innerHTML = preferences.length
    ? preferences.slice(0,5).map(artist => `<div class="five-item"><strong>${escapeHtml(artist.name)}</strong><span>${artist.count} call${artist.count === 1 ? "" : "s"}</span></div>`).join("")
    : `<div class="small" style="padding:15px 0">No recorded play votes yet.</div>`;
  if (preferences.length) {
    $("bestCall").textContent = preferences[0].name;
    $("bestCallCopy").textContent = `${preferences[0].count} recorded call${preferences[0].count === 1 ? "" : "s"} for this artist.`;
  } else {
    $("bestCall").textContent = "—";
    $("bestCallCopy").textContent = "Your most frequently chosen artist will appear here.";
  }
}

function daily() {
  show("daily");
  $("dailyStatus").textContent = "Coming soon";
  $("dailyLabel").textContent = "COMING SOON";
}

async function rankings() {
  trackEvent("ranking_view");
  show("rankings");
  await renderRankings();
}

async function renderRankings() {
  $("rankList").innerHTML = "";
  $("rankingLabel").textContent = "LOADING";
  message("rankingMessage", "Loading real rankings...");

  const [rankingResult, instagramResult] = await Promise.all([
    supabaseClient.rpc("get_public_rankings"),
    supabaseClient.rpc("get_public_ranking_instagrams")
  ]);
  if (rankingResult.error) {
    $("rankingLabel").textContent = "ERROR";
    return message("rankingMessage", rankingResult.error.message, "error");
  }

  const rows = Array.isArray(rankingResult.data) ? rankingResult.data : [];
  const instagramById = new Map((Array.isArray(instagramResult.data) ? instagramResult.data : []).map(x => [x.artist_id, x.instagram_url]));
  window.fiveRankingRows = rows.map(r => ({...r, instagram_url: instagramById.get(r.artist_id) || ""}));
  if (!rows.length) {
    $("rankingLabel").textContent = "EMPTY";
    message("rankingMessage", "No public calls have been recorded yet.");
    $("rankList").innerHTML = `<div class="report"><h3>No rankings yet.</h3><div class="small">Make real calls to build the ranking.</div></div>`;
    return;
  }

  message("rankingMessage", "");
  $("rankingLabel").textContent = `${rows.length} ARTIST${rows.length === 1 ? "" : "S"}`;
  $("rankList").innerHTML = `
    <div class="field" style="margin:0 0 22px">
      <label for="rankingSearch">SEARCH ARTISTS</label>
      <input id="rankingSearch" type="search" placeholder="Search by artist name…" oninput="filterRankings()">
    </div>
    <div id="rankingResults"></div>`;
  filterRankings();
}

function filterRankings(resetPage = true) {
  const target = $("rankingResults");
  if (!target) return;
  if (resetPage) rankingPage = 1;
  const query = String($("rankingSearch")?.value || "").trim().toLowerCase();
  const rows = (window.fiveRankingRows || []).filter(r => String(r.name || "").toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(rows.length / RANKING_PAGE_SIZE));
  rankingPage = Math.min(rankingPage, totalPages);
  const visibleRows = rows.slice((rankingPage - 1) * RANKING_PAGE_SIZE, rankingPage * RANKING_PAGE_SIZE);
  target.innerHTML = rows.length ? visibleRows.map(r => `
    <div class="rank-row">
      <div class="rank-num">#${escapeHtml(r.rank)}</div>
      <div><div class="rank-artist">${escapeHtml(r.name)}</div>
      <div class="rank-country">${escapeHtml(r.country || "Country not listed")}</div></div>
      <div class="rank-choice">${escapeHtml(r.choices ?? 0)} choices</div>
      <div class="rank-choice">${r.instagram_url ? `<a href="${escapeHtml(normalizeInstagram(r.instagram_url))}" target="_blank" rel="noopener noreferrer">OPEN INSTAGRAM</a>` : '<span class="small">Instagram unavailable</span>'}</div>
    </div>`).join("") : '<div class="small">No artists match your search.</div>';
  const existing = $("rankingPagination");
  if (existing) existing.remove();
  if (rows.length > RANKING_PAGE_SIZE) {
    const pagination = document.createElement("div");
    pagination.id = "rankingPagination";
    pagination.style.cssText = "display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:20px 0 8px";
    const first = (rankingPage - 1) * RANKING_PAGE_SIZE + 1;
    const last = Math.min(rankingPage * RANKING_PAGE_SIZE, rows.length);
    pagination.innerHTML = `<span class="small">Showing ${first}–${last} of ${rows.length} artists</span><div style="display:flex;align-items:center;gap:10px"><button class="secondary" ${rankingPage <= 1 ? "disabled" : ""} onclick="changeRankingPage(-1)">PREVIOUS</button><span class="small">PAGE ${rankingPage} / ${totalPages}</span><button class="secondary" ${rankingPage >= totalPages ? "disabled" : ""} onclick="changeRankingPage(1)">NEXT</button></div>`;
    target.after(pagination);
  }
}

function changeRankingPage(delta) {
  const query = String($("rankingSearch")?.value || "").trim().toLowerCase();
  const total = (window.fiveRankingRows || []).filter(r => String(r.name || "").toLowerCase().includes(query)).length;
  const pages = Math.max(1, Math.ceil(total / RANKING_PAGE_SIZE));
  rankingPage = Math.max(1, Math.min(pages, rankingPage + delta));
  filterRankings(false);
  $("rankings")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function submitArtist() {
  if (!signedIn()) return authView("Sign in to submit an artist.");
  show("submit");
  message("submitMessage", "");
}

async function sendSubmission() {
  if (!signedIn()) return authView("Sign in to submit an artist.");

  const name = $("artistName").value.trim();
  const country = $("artistCountry").value.trim();
  const instagram_url = normalizeInstagram($("artistInstagram").value);
  const email = $("artistEmail").value.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!name || !country || !instagram_url || !validEmail) {
    return message("submitMessage", "Artist name, country, a valid Instagram, and a valid email are required.", "error");
  }

  setButton("submitArtistButton", true, "SENDING...");
  const { error } = await supabaseClient.from("artist_submissions").insert({
    submitted_by: currentSession.user.id,
    name,
    country,
    instagram_url,
    email
  });
  setButton("submitArtistButton", false);

  if (error) return message("submitMessage", error.message, "error");

  ["artistName", "artistCountry", "artistInstagram", "artistEmail"].forEach(id => { if ($(id)) $(id).value = "" });
  trackEvent("artist_submission");
  message("submitMessage", "Artist submitted for FIVE review. The email address will be used to communicate the review result.", "success");
}

async function shareEye() {
  const playCalls = myCalls.filter(call => (call.mode || "play") === "play");
  const counts = new Map();
  playCalls.forEach(call => {
    const a = call.artists || {};
    const id = call.artist_id;
    if (!id) return;
    const entry = counts.get(id) || { name: a.name || "Artist", count: 0 };
    entry.count += 1; counts.set(id, entry);
  });
  const favorite = [...counts.values()].sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name))[0];
  await shareFiveStory({
    title: favorite?.name || "MY FIVE EYE",
    subtitle: favorite ? `MY TOP ARTIST · ${favorite.count} CALL${favorite.count===1?"":"S"}` : `${playCalls.length} REAL CALLS`,
    detail: favorite ? `The artist I have chosen most often on FIVE. My discovery history keeps growing.` : `I am building my personal discovery history on FIVE.`,
    type: favorite ? "artist" : "eye"
  });
}

async function shareFiveStory({title, subtitle, detail, type}) {
  const canvas = document.createElement("canvas"); canvas.width=1080; canvas.height=1920;
  const ctx=canvas.getContext("2d"); ctx.fillStyle="#f1efe9";ctx.fillRect(0,0,1080,1920);
  ctx.fillStyle="#1685ff";ctx.fillRect(72,86,120,12);ctx.fillStyle="#111";ctx.font="900 72px Arial";ctx.fillText("FIVE",72,190);
  ctx.strokeStyle="#111";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(72,235);ctx.lineTo(1008,235);ctx.stroke();
  ctx.fillStyle="#77736c";ctx.font="500 28px Arial";ctx.fillText(type==="artist"?"MY MOST-CHOSEN ARTIST":"MY DISCOVERY PROFILE",72,330);
  ctx.fillStyle="#111";ctx.font="900 88px Arial";let words=String(title).toUpperCase().split(" "),lines=[],line="";
  words.forEach(w=>{const test=line?line+" "+w:w;if(ctx.measureText(test).width>900&&line){lines.push(line);line=w;}else line=test;});if(line)lines.push(line);let y=520;lines.slice(0,3).forEach(t=>{ctx.fillText(t,72,y);y+=100;});
  ctx.fillStyle="#1685ff";ctx.font="700 32px Arial";ctx.fillText(String(subtitle).toUpperCase(),72,y+28);ctx.fillStyle="#111";ctx.fillRect(72,y+82,936,5);
  ctx.fillStyle="#55524c";ctx.font="400 34px Arial";let dw=String(detail).split(" "),dl="",dy=y+155;dw.forEach(w=>{const t=dl?dl+" "+w:w;if(ctx.measureText(t).width>900&&dl){ctx.fillText(dl,72,dy);dy+=48;dl=w;}else dl=t;});if(dl)ctx.fillText(dl,72,dy);
  ctx.fillStyle="#111";ctx.fillRect(72,1660,936,180);ctx.fillStyle="#f1efe9";ctx.font="700 28px Arial";ctx.fillText("DISCOVER. CHOOSE. RANK.",108,1730);ctx.fillStyle="#1685ff";ctx.font="900 46px Arial";ctx.fillText("FIVE",108,1795);ctx.fillStyle="#77736c";ctx.font="400 24px Arial";ctx.fillText("murtburnerlab.github.io/five",72,1880);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)return;
  const file=new File([blob],"five-story.png",{type:"image/png"});
  try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({files:[file],title:"My FIVE Story",text:`${title} — ${subtitle}`});else{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="five-story.png";a.click();URL.revokeObjectURL(a.href);alert("Story image saved. Upload it to Instagram Stories.");}}catch(e){if(e?.name!=="AbortError")alert("Could not share the story image. Please try again.");}
}


function ensureAdminUI() {
  if (!$("admin")) {
    const main = document.querySelector("main");
    if (!main) return;
    const section = document.createElement("section");
    section.id = "admin";
    section.className = "view hidden";
    section.innerHTML = `
      <div class="section-head">
        <div><div class="eyebrow">FIVE CONTROL</div><div class="section-title">ADMIN</div></div>
        <div class="round" id="adminSummary">LOADING</div>
      </div>
      <div id="adminMessage" class="message hidden"></div>
      <div class="report" style="margin:22px 0">
        <div class="eyebrow">ADD ARTIST</div>
        <div class="form">
          <div class="field"><label for="adminArtistName">Artist name *</label><input id="adminArtistName" maxlength="160" placeholder="Artist name" required></div>
          <div class="field"><label for="adminArtistCountry">Country *</label><input id="adminArtistCountry" maxlength="100" placeholder="Country" required></div>
          <div class="field"><label for="adminArtistInstagram">Instagram *</label><input id="adminArtistInstagram" type="text" placeholder="@username or Instagram URL" required></div>
        </div>
        <button class="primary" id="adminAddButton" onclick="adminAddArtist()">ADD ARTIST</button>
      </div>
      <div class="report" style="margin:22px 0">
        <div class="section-head" style="margin-bottom:14px">
          <div><div class="eyebrow">REVIEW QUEUE</div><h3 style="margin:8px 0">SUBMISSIONS</h3></div>
          <button class="secondary" onclick="loadAdminData()">REFRESH</button>
        </div>
        <div class="field" style="margin:12px 0"><label for="adminSubmissionSearch">SEARCH NAME OR EMAIL</label><input id="adminSubmissionSearch" type="search" placeholder="Search submissions…" oninput="searchAdminSubmissions()"></div>
        <div class="field" style="margin:12px 0 18px"><label for="adminSubmissionStatus">STATUS</label><select id="adminSubmissionStatus" onchange="changeSubmissionStatus()"><option value="pending">PENDING REVIEW</option><option value="approved">APPROVED</option><option value="rejected">REJECTED</option><option value="all">ALL SUBMISSIONS</option></select></div>
        <div id="adminSubmissions"><div class="small">Loading submissions…</div></div>
        <div id="adminSubmissionPagination" class="admin-pagination"></div>
      </div>
      <div class="report" style="margin:22px 0">
        <div class="section-head" style="margin-bottom:14px">
          <div><div class="eyebrow">DATABASE</div><h3 style="margin:8px 0">ARTISTS</h3></div>
          <div class="small">Existing call history is preserved.</div>
        </div>
        <div class="field" style="margin:12px 0 18px"><label for="adminArtistSearch">SEARCH BY ARTIST NAME</label><input id="adminArtistSearch" type="search" placeholder="Type an artist name…" oninput="searchAdminArtists()"></div>
        <div class="field" style="margin:12px 0 18px"><label for="adminArtistStatus">STATUS</label><select id="adminArtistStatus" onchange="changeArtistStatus()"><option value="approved">APPROVED</option><option value="pending">PENDING</option><option value="rejected">REJECTED</option><option value="all">ALL ARTISTS</option></select></div>
        <div id="adminArtists"><div class="small">Loading artists…</div></div>
        <div id="adminArtistPagination" class="admin-pagination"></div>
      </div>
      <div class="report" style="margin:22px 0">
        <div class="section-head" style="margin-bottom:14px"><div><div class="eyebrow">PERFORMANCE</div><h3 style="margin:8px 0">STATISTICS</h3></div><button class="secondary" onclick="loadAdminStats()">REFRESH</button></div>
        <div id="adminStats" class="small">Loading statistics…</div>
        <div class="small" style="margin-top:14px">Visit tracking starts after this update is published. Historical visits before tracking was added are not available.</div>
      </div>`;
    main.appendChild(section);
  }

  let navButton = $("adminNav");
  if (!navButton) {
    const nav = document.querySelector(".topnav");
    if (nav) {
      navButton = document.createElement("button");
      navButton.id = "adminNav";
      navButton.textContent = "ADMIN";
      navButton.onclick = openAdmin;
      nav.appendChild(navButton);
    }
  }
  if (navButton) navButton.classList.toggle("hidden", !isFiveAdmin);
}

async function refreshAdminAccess() {
  if (!signedIn()) {
    isFiveAdmin = false;
    $("adminNav")?.classList.add("hidden");
    if ($("admin") && !$("admin").classList.contains("hidden")) home();
    return false;
  }
  try {
    const { data, error } = await supabaseClient.rpc("is_five_admin");
    if (error) throw error;
    isFiveAdmin = data === true;
  } catch (error) {
    isFiveAdmin = false;
    console.error("FIVE admin access check failed:", error);
  }
  ensureAdminUI();
  return isFiveAdmin;
}

async function openAdmin() {
  const allowed = await refreshAdminAccess();
  if (!allowed) return authView("Admin access is restricted.");
  show("admin");
  await loadAdminData();
}

function adminNotice(text, type = "") {
  message("adminMessage", text, type);
}

async function loadAdminData() {
  if (!isFiveAdmin) return adminNotice("Admin access is required.", "error");
  adminNotice("");
  await Promise.all([loadAdminSubmissions(), loadAdminArtists()]);
  loadAdminStats();
}
async function loadAdminSubmissions() {
  const el=$("adminSubmissions");if(!el||!isFiveAdmin)return;el.innerHTML='<div class="small">Loading submissions…</div>';
  const status=$("adminSubmissionStatus")?.value||"pending",search=$("adminSubmissionSearch")?.value||"";
  const {data,error}=await supabaseClient.rpc("admin_list_submissions_page",{p_page:adminSubmissionPage,p_page_size:ADMIN_PAGE_SIZE,p_status:status,p_search:search});
  if(error){el.innerHTML='<div class="small">Could not load submissions: '+escapeHtml(error.message)+'</div>';return}
  const result=typeof data==="string"?JSON.parse(data):data,rows=Array.isArray(result?.rows)?result.rows:[];
  adminSubmissionRows=rows;adminSubmissionTotal=Number(result?.total_count||0);
  if($("adminSummary"))$("adminSummary").textContent=adminSubmissionTotal+" "+status.toUpperCase();
  el.innerHTML=rows.length?rows.map(row=>`
    <div class="panel-row" style="align-items:center"><div style="flex:1;min-width:0">
      <div style="font-size:16px;font-weight:700">${escapeHtml(row.name)}</div><div class="small">${escapeHtml(row.country)} · ${escapeHtml(row.status)}</div>
      <div class="small" style="margin-top:5px">Email: ${escapeHtml(row.email||"Not provided")}</div>
      ${row.status!=="pending"?`<div class="small" style="margin-top:5px">Notification: ${escapeHtml(String(row.notification_status||"not_sent").replaceAll("_"," ").toUpperCase())}${row.notification_error?` · ${escapeHtml(row.notification_error)}`:""}</div>`:""}
      ${row.instagram_url?`<a style="display:inline-block;margin-top:8px" href="${escapeHtml(normalizeInstagram(row.instagram_url)||"#")}" target="_blank" rel="noopener">OPEN INSTAGRAM</a>`:`<div class="small">Instagram missing</div>`}
    </div>${row.status==="pending"?`<div style="display:flex;flex-direction:column;gap:8px"><button class="primary" onclick="adminReviewSubmission('${escapeHtml(row.id)}','approved')">APPROVE</button><button class="secondary" onclick="adminReviewSubmission('${escapeHtml(row.id)}','rejected')">REJECT</button></div>`:""}</div>`).join(""):'<div class="small">No submissions found for this filter.</div>';
  renderAdminPagination("adminSubmissionPagination",adminSubmissionPage,adminSubmissionTotal,"changeSubmissionPage");
}
function renderAdminPagination(id,page,total,callback){
 const el=$(id);if(!el)return;const pages=Math.max(1,Math.ceil(total/ADMIN_PAGE_SIZE)),first=total?(page-1)*ADMIN_PAGE_SIZE+1:0,last=Math.min(page*ADMIN_PAGE_SIZE,total);
 el.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding-top:16px"><span class="small">Showing ${first}–${last} of ${total}</span><div style="display:flex;align-items:center;gap:10px"><button class="secondary" ${page<=1?"disabled":""} onclick="${callback}(-1)">PREVIOUS</button><span class="small">PAGE ${page} / ${pages}</span><button class="secondary" ${page>=pages?"disabled":""} onclick="${callback}(1)">NEXT</button></div></div>`;
}
function searchAdminSubmissions(){adminSubmissionPage=1;loadAdminSubmissions()}
function changeSubmissionStatus(){adminSubmissionPage=1;loadAdminSubmissions()}
function changeSubmissionPage(delta){adminSubmissionPage=Math.max(1,adminSubmissionPage+delta);loadAdminSubmissions()}
async function loadAdminArtists(){
 const el=$("adminArtists");if(!el||!isFiveAdmin)return;el.innerHTML='<div class="small">Loading artists…</div>';
 const status=$("adminArtistStatus")?.value||"approved",search=$("adminArtistSearch")?.value||"";
 const {data,error}=await supabaseClient.rpc("admin_list_artists_page",{p_page:adminArtistPage,p_page_size:ADMIN_PAGE_SIZE,p_status:status,p_search:search});
 if(error){el.innerHTML='<div class="small">Could not load artists: '+escapeHtml(error.message)+'</div>';return}
 const result=typeof data==="string"?JSON.parse(data):data;adminArtistRows=Array.isArray(result?.rows)?result.rows:[];adminArtistTotal=Number(result?.total_count||0);
 el.innerHTML=adminArtistRows.length?adminArtistRows.map(row=>`<div class="panel-row" style="align-items:center;gap:12px"><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:700">${escapeHtml(row.name)}</div><div class="small">${escapeHtml(row.country)} · ${escapeHtml(row.status)}</div>${row.instagram_url?`<a style="display:inline-block;margin-top:8px" href="${escapeHtml(normalizeInstagram(row.instagram_url)||"#")}" target="_blank" rel="noopener">OPEN INSTAGRAM</a>`:`<div class="small">Instagram missing</div>`}</div><div style="display:flex;flex-direction:column;gap:8px"><button class="secondary" onclick="adminEditArtist('${escapeHtml(row.id)}')">EDIT</button><button class="secondary" onclick="adminDeleteArtist('${escapeHtml(row.id)}')">REMOVE</button></div></div>`).join(""):'<div class="small">No artists match this filter.</div>';
 renderAdminPagination("adminArtistPagination",adminArtistPage,adminArtistTotal,"changeArtistPage");
}
function searchAdminArtists(){adminArtistPage=1;loadAdminArtists()}
function changeArtistStatus(){adminArtistPage=1;loadAdminArtists()}
function changeArtistPage(delta){adminArtistPage=Math.max(1,adminArtistPage+delta);loadAdminArtists()}
function filterAdminArtists(){loadAdminArtists()}

async function adminEditArtist(id){
 if(!isFiveAdmin||adminBusy)return;const row=adminArtistRows.find(r=>r.id===id);if(!row)return;
 const name=prompt("Artist name",row.name);if(name===null)return;const country=prompt("Country",row.country);if(country===null)return;const raw=prompt("Instagram username or URL",row.instagram_url||"");if(raw===null)return;
 const instagram=normalizeInstagram(raw);if(!name.trim()||!country.trim()||!instagram)return adminNotice("Enter a valid name, country, and Instagram.","error");
 adminBusy=true;try{const {error}=await supabaseClient.rpc("admin_update_artist",{p_artist_id:id,p_name:name.trim(),p_country:country.trim(),p_instagram_url:instagram});if(error)throw error;adminNotice("Artist information updated.","success");await loadAdminData();await loadHomeData()}catch(e){adminNotice(e.message||"Could not update artist.","error")}finally{adminBusy=false}
}
async function loadAdminStats(){
 const el=$("adminStats");if(!isFiveAdmin||!el)return;el.innerHTML='<div class="small">Loading statistics…</div>';const {data,error}=await supabaseClient.rpc("admin_get_stats");
 if(error){el.innerHTML='<div class="small">Could not load statistics: '+escapeHtml(error.message)+'</div>';return}const rows=Array.isArray(data)?data:[];
 el.innerHTML=rows.length?'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px">'+rows.map(r=>'<div style="border:1px solid var(--line,#d8d4cb);padding:14px"><div class="small">'+escapeHtml(r.metric)+'</div><div style="font-size:25px;font-weight:700;margin-top:8px">'+escapeHtml(Number(r.value||0).toLocaleString())+'</div></div>').join('')+'</div>':'<div class="small">No statistics available yet.</div>';
}

async function adminReviewSubmission(submissionId, decision) {
  if (!isFiveAdmin || adminBusy) return;
  if (!["approved", "rejected"].includes(decision)) return;
  const row = decision === "approved" ? "Approve this artist and add them to the public pool?" : "Reject this submission?";
  if (!window.confirm(row)) return;
  adminBusy = true;
  try {
    const { error } = await supabaseClient.rpc("admin_review_submission", {
      p_submission_id: submissionId,
      p_decision: decision
    });
    if (error) throw error;
    let emailResult = null;
    const { data: notificationData, error: notificationError } = await supabaseClient.functions.invoke("five-send-review-email", {
      body: { submission_id: submissionId }
    });
    if (notificationError) {
      emailResult = "Decision saved. Email notification could not run: " + notificationError.message;
    } else if (notificationData?.status === "sent") {
      emailResult = "Decision saved and notification email sent.";
    } else if (notificationData?.status === "not_configured") {
      emailResult = "Decision saved. Email delivery is prepared but not active until the email provider is configured.";
    } else {
      emailResult = "Decision saved. Email status: " + String(notificationData?.status || "unknown") + (notificationData?.error ? " — " + notificationData.error : "");
    }
    adminNotice((decision === "approved" ? "Artist approved and added to the database. " : "Submission rejected. ") + emailResult, "success");
    await loadAdminData();
    await loadHomeData();
  } catch (error) {
    adminNotice(error.message || "Could not update this submission.", "error");
  } finally {
    adminBusy = false;
  }
}

async function adminAddArtist() {
  if (!isFiveAdmin || adminBusy) return;
  const name = $("adminArtistName")?.value.trim();
  const country = $("adminArtistCountry")?.value.trim();
  const instagram = normalizeInstagram($("adminArtistInstagram")?.value);
  if (!name || !country || !instagram) return adminNotice("Artist name, country, and Instagram are required.", "error");
  adminBusy = true;
  setButton("adminAddButton", true, "ADDING...");
  try {
    const { error } = await supabaseClient.rpc("admin_add_artist", {
      p_name: name,
      p_country: country,
      p_instagram_url: instagram,
      p_website_url: null,
      p_image_url: null,
      p_categories: []
    });
    if (error) throw error;
    ["adminArtistName", "adminArtistCountry", "adminArtistInstagram"].forEach(id => { if ($(id)) $(id).value = ""; });
    adminNotice("Artist added and approved.", "success");
    await loadAdminData();
    await loadHomeData();
  } catch (error) {
    adminNotice(error.message || "Could not add artist.", "error");
  } finally {
    adminBusy = false;
    setButton("adminAddButton", false);
  }
}

async function adminDeleteArtist(artistId) {
  if (!isFiveAdmin || adminBusy) return;
  if (!window.confirm("Remove this artist from the active artist database? Existing call history will be preserved.")) return;
  adminBusy = true;
  try {
    const { data: removalResult, error } = await supabaseClient.rpc("admin_remove_artist", { p_artist_id: artistId });
    if (error) throw error;
    adminNotice(removalResult === "archived" ? "Artist removed from the active pool. Historical votes were preserved." : "Artist permanently removed from the database.", "success");
    await loadAdminData();
    await loadHomeData();
  } catch (error) {
    adminNotice(error.message || "Could not remove artist.", "error");
  } finally {
    adminBusy = false;
  }
}

async function init() {
  if (!window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY) {
    return authView("Supabase configuration is missing.");
  }

  const { data } = await supabaseClient.auth.getSession();
  currentSession = data.session;

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    loadMyCalls().then(updateAuthUI);
    refreshAdminAccess();
  });

  await loadMyCalls();
  updateAuthUI();
  await refreshAdminAccess();
  trackEvent("page_view");
  home();
}

window.home=home;
window.play=play;
window.eye=eye;
window.daily=daily;
window.rankings=rankings;
window.filterRankings=filterRankings;
window.changeRankingPage=changeRankingPage;
window.submitArtist=submitArtist;
window.authView=authView;
window.setAuthMode=setAuthMode;
window.submitAuth=submitAuth;
window.signOut=signOut;
window.nextRound=nextRound;
window.viewCalls=viewCalls;
window.choose=choose;
window.sendSubmission=sendSubmission;
window.shareEye=shareEye;
window.openAdmin=openAdmin;
window.loadAdminData=loadAdminData;
window.adminReviewSubmission=adminReviewSubmission;
window.adminAddArtist=adminAddArtist;
window.adminDeleteArtist=adminDeleteArtist;
window.adminEditArtist=adminEditArtist;
window.filterAdminArtists=filterAdminArtists;
window.searchAdminSubmissions=searchAdminSubmissions;
window.changeSubmissionStatus=changeSubmissionStatus;
window.changeSubmissionPage=changeSubmissionPage;
window.searchAdminArtists=searchAdminArtists;
window.changeArtistStatus=changeArtistStatus;
window.changeArtistPage=changeArtistPage;
window.loadAdminStats=loadAdminStats;

init();
