const supabaseClient = window.supabase.createClient(
  window.FIVE_SUPABASE_URL,
  window.FIVE_SUPABASE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const $ = id => document.getElementById(id);
const views = ["home","auth","play","result","calls","eye","daily","rankings","submit"];

let currentSession = null;
let authMode = "signin";
let currentRound = null;
let profileIndex = -1;
let myCalls = [];
let busy = false;

function show(id) {
  views.forEach(v => $(v)?.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
  closeProfile();
}

function message(id, text, type = "") {
  const el = $(id);
  if (!el) return;
  el.textContent = text || "";
  el.className = "message" + (type ? " " + type : "");
  el.classList.toggle("hidden", !text);
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

function updateAuthUI() {
  const ok = signedIn();
  if ($("authNav")) $("authNav").textContent = ok ? "ACCOUNT" : "SIGN IN";
  if ($("counter")) $("counter").textContent = ok ? (currentSession.user.email || "SIGNED IN") : "SIGNED OUT";
  if ($("homeAuth")) $("homeAuth").textContent = ok ? (currentSession.user.email || "Signed in") : "Signed out";
  if ($("homeCalls")) $("homeCalls").textContent = ok ? String(myCalls.length) : "Sign in";
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
  const result = authMode === "signup"
    ? await supabaseClient.auth.signUp({ email, password })
    : await supabaseClient.auth.signInWithPassword({ email, password });
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
}

function normalizeArtist(row, roundId) {
  return {
    id: row.artist_id || row.id,
    roundId: row.round_id || roundId,
    name: row.name || "Untitled artist",
    country: row.country || "",
    instagramUrl: row.instagram_url || "",
    websiteUrl: row.website_url || "",
    imageUrl: row.image_url || "",
    categories: row.categories || []
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
    $("roundLabel").textContent = "ERROR";
    return message("playMessage", error.message, "error");
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
  $("grid").innerHTML = currentRound.artists.map((a,i) => `
    <article class="card">
      <div class="number">0${i+1}</div>
      <div class="name">${escapeHtml(a.name)}</div>
      <div class="country">${escapeHtml(a.country || "Country not listed")}</div>
      <div class="tags">${(a.categories || []).slice(0,3).map(x => `<span class="tagpill">${escapeHtml(x)}</span>`).join("")}</div>
      <div class="card-actions">
        <button class="profile" onclick="openProfile(${i})">PROFILE</button>
        <button class="choose" onclick="choose(${i})">CHOOSE</button>
      </div>
    </article>`).join("");
}

function openProfile(i) {
  const a = currentRound?.artists[i];
  if (!a) return;
  profileIndex = i;
  $("profileName").textContent = a.name;
  $("profileCountry").textContent = a.country || "Country not listed";
  $("profileCopy").textContent = (a.categories || []).length
    ? a.categories.join(" Â· ")
    : "Artist profile from the FIVE database.";

  const ig = url(a.instagramUrl), site = url(a.websiteUrl);
  $("profileInstagram").href = ig || "#";
  $("profileWebsite").href = site || "#";
  $("profileInstagram").classList.toggle("hidden", !ig);
  $("profileWebsite").classList.toggle("hidden", !site);
  $("modal").classList.remove("hidden");
}

function closeProfile() {
  $("modal")?.classList.add("hidden");
  profileIndex = -1;
}

function chooseProfile() {
  if (profileIndex >= 0) choose(profileIndex);
}

async function choose(i) {
  const a = currentRound?.artists[i];
  if (!a || busy) return;
  busy = true;
  document.querySelectorAll(".choose,#profileChoose").forEach(b => b.disabled = true);
  message("playMessage", "Recording your call...");

  const { error } = await supabaseClient.rpc("record_call", {
    p_round_id: currentRound.roundId,
    p_artist_id: a.id,
    p_rank_at_choice: null
  });

  if (error) {
    busy = false;
    document.querySelectorAll(".choose,#profileChoose").forEach(b => b.disabled = false);
    return message("playMessage", error.message, "error");
  }

  $("chosen").textContent = a.name;
  $("chosenMeta").textContent = a.country || "Country not listed";
  $("resultRank").textContent = "RECORDED";
  $("resultStatus").textContent = "SAVED";

  await loadMyCalls();
  busy = false;
  show("result");
  updateAuthUI();
}

function nextRound() { play(); }

async function loadMyCalls() {
  if (!signedIn()) {
    myCalls = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("calls")
    .select("id,created_at,rank_at_choice,artist_id,artists(id,name,country,instagram_url,website_url)")
    .eq("user_id", currentSession.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    myCalls = [];
    return;
  }
  myCalls = data || [];
  updateAuthUI();
}

async function viewCalls() {
  if (!signedIn()) return authView("Sign in to see your calls.");
  show("calls");
  await loadMyCalls();
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
      <div class="rank-old">â</div>
      <div><div class="call-name">${escapeHtml(a.name || "Artist")}</div>
      <div class="call-country">${escapeHtml(a.country || "Country not listed")} Â· ${escapeHtml(d)}</div></div>
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
  const n = myCalls.length;
  $("eyeCount").textContent = `${n} REAL CALL${n === 1 ? "" : "S"}`;
  $("eyeHeadline").textContent = n < 10 ? "Your eye is starting to form." : "Your history is now measurable.";
  $("eyeCopy").textContent = n < 10
    ? `Make ${10-n} more call${10-n === 1 ? "" : "s"} to unlock the first real signal.`
    : "FIVE is ready to calculate your first real taste signals once the ranking history is deep enough.";

  $("metrics").innerHTML = ["EARLY","INDEPENDENT","EXPLORER"].map(name => `
    <div class="metric"><div class="metric-name">${name}</div>
    <div class="metric-num">â</div>
    <div class="metric-copy">Not enough backend history yet.</div></div>`).join("");

  $("fiveList").innerHTML = `<div class="small" style="padding:15px 0">Your repeated artist preferences will appear here after enough real calls.</div>`;
  $("bestCall").textContent = "â";
  $("bestCallCopy").textContent = "FIVE will calculate this from real ranking movement.";
}

function daily() {
  show("daily");
  $("dailyStatus").textContent = "Coming soon";
  $("dailyLabel").textContent = "COMING SOON";
}

async function rankings() {
  if (!signedIn()) return authView("Sign in to view the live rankings.");
  show("rankings");
  await renderRankings();
}

async function renderRankings() {
  $("rankList").innerHTML = "";
  $("rankingLabel").textContent = "LOADING";
  message("rankingMessage", "Loading real rankings...");

  const { data, error } = await supabaseClient.rpc("get_public_rankings");
  if (error) {
    $("rankingLabel").textContent = "ERROR";
    return message("rankingMessage", error.message, "error");
  }

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    $("rankingLabel").textContent = "EMPTY";
    message("rankingMessage", "No public calls have been recorded yet.");
    $("rankList").innerHTML = `<div class="report"><h3>No rankings yet.</h3><div class="small">Make real calls to build the ranking.</div></div>`;
    return;
  }

  message("rankingMessage", "");
  $("rankingLabel").textContent = `${rows.length} ARTIST${rows.length === 1 ? "" : "S"}`;
  $("rankList").innerHTML = rows.map((r,i) => `
    <div class="rank-row">
      <div class="rank-num">#${escapeHtml(r.rank ?? i+1)}</div>
      <div><div class="rank-artist">${escapeHtml(r.name)}</div>
      <div class="rank-country">${escapeHtml(r.country || "Country not listed")}</div></div>
      <div class="rank-choice">${escapeHtml(r.choices ?? 0)}</div>
      <div class="rank-choice">choices</div>
    </div>`).join("");
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
  const instagram_url = url($("artistInstagram").value);
  const website_url = url($("artistWebsite").value);

  if (!name || !country) return message("submitMessage", "Artist name and country are required.", "error");

  setButton("submitArtistButton", true, "SENDING...");
  const { error } = await supabaseClient.from("artist_submissions").insert({
    submitted_by: currentSession.user.id,
    name,
    country,
    instagram_url: instagram_url || null,
    website_url: website_url || null
  });
  setButton("submitArtistButton", false);

  if (error) return message("submitMessage", error.message, "error");

  ["artistName","artistCountry","artistInstagram","artistWebsite"].forEach(id => $(id).value = "");
  message("submitMessage", "Artist submitted for FIVE review.", "success");
}

async function shareEye() {
  const text = `My FIVE Eye â ${myCalls.length} real calls.`;
  const data = { title: "My FIVE Eye", text, url: location.href };
  try {
    if (navigator.share) return await navigator.share(data);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      return alert("Share link copied.");
    }
    prompt("Copy your FIVE Eye link:", location.href);
  } catch (e) {
    if (e?.name !== "AbortError") prompt("Copy your FIVE Eye link:", location.href);
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
  });

  await loadMyCalls();
  updateAuthUI();
  home();
}

window.home=home;
window.play=play;
window.eye=eye;
window.daily=daily;
window.rankings=rankings;
window.submitArtist=submitArtist;
window.authView=authView;
window.setAuthMode=setAuthMode;
window.submitAuth=submitAuth;
window.signOut=signOut;
window.nextRound=nextRound;
window.viewCalls=viewCalls;
window.openProfile=openProfile;
window.closeProfile=closeProfile;
window.chooseProfile=chooseProfile;
window.choose=choose;
window.sendSubmission=sendSubmission;
window.shareEye=shareEye;

init();
