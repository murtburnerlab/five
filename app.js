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
  if ($("homeCalls")) $("homeCalls").textContent = ok ? String(myCalls.filter(c => (c.mode || "play") === "play").length) : "Sign in";
  if ($("homeActive")) $("homeActive").textContent = ok ? "0" : "—";
  if ($("homeUnlock")) {
    const count = myCalls.filter(c => (c.mode || "play") === "play").length;
    $("homeUnlock").textContent = count >= 10 ? "YOUR EYE unlocked" : `${10-count} calls → YOUR EYE`;
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
  loadHomeData();
}

async function loadHomeData() {
  const list = $("homeTopFive");
  const artistsEl = $("globalArtists");
  const choicesEl = $("globalChoices");
  if (list) list.innerHTML = `<div class="small">Loading live ranking…</div>`;
  try {
    const { data, error } = await supabaseClient.rpc("get_public_rankings");
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (artistsEl) artistsEl.textContent = String(rows.length);
    const totalChoices = rows.reduce((sum, row) => sum + Number(row.choices || 0), 0);
    if (choicesEl) choicesEl.textContent = String(totalChoices);
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = `<div class="small" style="padding:15px 0">No public calls recorded yet.</div>`;
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
    if (artistsEl) artistsEl.textContent = "—";
    if (choicesEl) choicesEl.textContent = "—";
    if (list) list.innerHTML = `<div class="small" style="padding:15px 0">Ranking unavailable. ${escapeHtml(error?.message || "Please refresh.")}</div>`;
  }
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
    $("roundLabel").textContent = "LIMIT REACHED";
    const safeMessage = String(error.message || "Please try again tomorrow.").replace(/calendar day/gi, "day").replace(/\s{2,}/g, " ");
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
    ? a.categories.join(" · ")
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
  window.dispatchEvent(new CustomEvent("five:call-recorded"));
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
    .select("id,created_at,rank_at_choice,artist_id,mode,artists(id,name,country,instagram_url,website_url)")
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

  const unlockedMetrics = [];
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
  metricCards.forEach(metric => {
    if (n >= metric.count) {
      unlockedMetrics.push(metric);
    } else {
      unlockedMetrics.push({
        name: `${metric.name} · LOCKED`,
        value: `${metric.count-n} to go`,
        copy: `Reach ${metric.count} real calls to unlock this feature.`
      });
    }
  });
  $("metrics").innerHTML = unlockedMetrics.map(metric => `
    <div class="metric"><div class="metric-name">${escapeHtml(metric.name)}</div>
    <div class="metric-num">${escapeHtml(metric.value)}</div>
    <div class="metric-copy">${escapeHtml(metric.copy)}</div></div>`).join("");

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
