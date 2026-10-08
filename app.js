const supabaseClient = window.supabase.createClient(window.FIVE_SUPABASE_URL, window.FIVE_SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = id => document.getElementById(id);
const views = ['home', 'auth', 'play', 'result', 'calls', 'eye', 'daily', 'rankings', 'submit'];
let currentSession = null;
let authMode = 'signin';
let currentRound = null;
let profileIndex = -1;
let myCalls = [];
let isRecording = false;

function showMessage(id, text, type = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text || '';
  el.className = 'message' + (type ? ` ${type}` : '');
  el.classList.toggle('hidden', !text);
}

function hideAll() {
  views.forEach(id => $(id).classList.add('hidden'));
  closeProfile();
}

function setBusy(buttonId, busy, text) {
  const button = $(buttonId);
  if (!button) return;
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? text : button.dataset.originalText;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function normalizeUrl(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function label(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function getArtistName(row) {
  return row.artist_name || row.name || row.artist?.name || row.artists?.name || 'Untitled artist';
}

function normalizeArtist(row, fallbackRoundId) {
  const artist = row.artist || row.artists || row;
  return {
    id: row.artist_id || artist.artist_id || artist.id,
    roundId: row.round_id || row.round?.id || fallbackRoundId,
    name: getArtistName(row),
    country: row.country || artist.country || row.artist_country || '',
    instagramUrl: row.instagram_url || artist.instagram_url || row.instagram || artist.instagram || '',
    websiteUrl: row.website_url || artist.website_url || row.website || artist.website || '',
    rankAtChoice: row.rank_at_choice || row.current_rank || row.public_rank || row.rank || null,
    raw: row
  };
}

function normalizeRoundPayload(data) {
  const payload = Array.isArray(data) ? { artists: data } : (data || {});
  const rows = Array.isArray(payload.artists)
    ? payload.artists
    : Array.isArray(payload.round_artists)
      ? payload.round_artists
      : Array.isArray(payload.items)
        ? payload.items
        : [];
  const roundId = payload.round_id || payload.id || rows[0]?.round_id || rows[0]?.round?.id || null;
  return { roundId, artists: rows.map(row => normalizeArtist(row, roundId)).filter(artist => artist.id) };
}

function updateAuthUI() {
  const signedIn = Boolean(currentSession?.user);
  $('authNav').textContent = signedIn ? 'ACCOUNT' : 'SIGN IN';
  $('counter').textContent = signedIn ? label(currentSession.user.email, 'SIGNED IN') : 'SIGNED OUT';
  $('homeAuth').textContent = signedIn ? label(currentSession.user.email, 'Signed in') : 'Signed out';
  $('homeCalls').textContent = signedIn ? String(myCalls.length) : 'Sign in';
  $('signOutButton').classList.toggle('hidden', !signedIn);
  $('authEmail').value = signedIn ? currentSession.user.email || '' : $('authEmail').value;
  $('authPassword').disabled = signedIn;
  $('authSubmit').disabled = signedIn;
}

function setAuthMode(mode) {
  authMode = mode;
  const signingUp = authMode === 'signup';
  $('authTitle').textContent = signingUp ? 'CREATE ACCOUNT' : 'SIGN IN';
  $('authCopy').textContent = signingUp ? 'Create an account to start building your record.' : 'Sign in to make calls, submit artists, and build your record.';
  $('authSubmit').textContent = signingUp ? 'CREATE ACCOUNT' : 'SIGN IN';
  $('authPassword').autocomplete = signingUp ? 'new-password' : 'current-password';
  showMessage('authMessage', '');
}

function authView(message = '') {
  hideAll();
  $('auth').classList.remove('hidden');
  if (message) showMessage('authMessage', message);
  updateAuthUI();
}

async function submitAuth() {
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (!email || !password) {
    showMessage('authMessage', 'Enter an email and password.', 'error');
    return;
  }

  setBusy('authSubmit', true, authMode === 'signup' ? 'CREATING...' : 'SIGNING IN...');
  const request = authMode === 'signup'
    ? supabaseClient.auth.signUp({ email, password })
    : supabaseClient.auth.signInWithPassword({ email, password });
  const { data, error } = await request;
  setBusy('authSubmit', false);

  if (error) {
    showMessage('authMessage', error.message, 'error');
    return;
  }

  if (authMode === 'signup' && !data.session) {
    showMessage('authMessage', 'Account created. Check your email to confirm your address before signing in.', 'success');
    return;
  }

  currentSession = data.session || currentSession;
  showMessage('authMessage', 'Signed in.', 'success');
  await loadMyCalls();
  updateAuthUI();
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showMessage('authMessage', error.message, 'error');
    return;
  }

  currentSession = null;
  myCalls = [];
  currentRound = null;
  updateAuthUI();
  home();
}

function home() {
  hideAll();
  $('home').classList.remove('hidden');
  updateAuthUI();
}

async function play() {
  if (!currentSession?.user) {
    authView('Sign in to make a call.');
    return;
  }

  hideAll();
  $('play').classList.remove('hidden');
  await newRound();
}

function nextRound() {
  play();
}

async function newRound() {
  $('grid').innerHTML = '';
  showMessage('playMessage', 'Loading a real FIVE round...');
  $('roundLabel').textContent = 'LOADING';

  const { data, error } = await supabaseClient.rpc('create_play_round', { p_mode: 'play' });
  if (error) {
    showMessage('playMessage', error.message, 'error');
    return;
  }

  currentRound = normalizeRoundPayload(data);
  if (!currentRound.roundId || currentRound.artists.length !== 5) {
    showMessage('playMessage', 'The server did not return exactly five artists for this round.', 'error');
    currentRound = null;
    return;
  }

  showMessage('playMessage', '');
  $('roundLabel').textContent = 'SERVER ROUND';
  renderRound();
}

function renderRound() {
  if (!currentRound) return;
  $('grid').innerHTML = currentRound.artists.map((artist, index) => `
    <article class="card">
      <div class="number">0${index + 1}</div>
      <div class="name">${escapeHtml(artist.name)}</div>
      <div class="country">${escapeHtml(label(artist.country, 'Country not listed'))}</div>
      <div class="tags">${artist.rankAtChoice ? `<span class="tagpill">Rank #${escapeHtml(artist.rankAtChoice)}</span>` : '<span class="tagpill">FIVE artist</span>'}</div>
      <div class="card-actions"><button class="profile" onclick="openProfile(${index})">PROFILE</button><button class="choose" onclick="choose(${index})">CHOOSE</button></div>
    </article>
  `).join('');
}

function openProfile(index) {
  if (!currentRound?.artists[index]) return;
  profileIndex = index;
  const artist = currentRound.artists[index];
  $('profileName').textContent = artist.name;
  $('profileCountry').textContent = label(artist.country, 'Country not listed');
  $('profileCopy').textContent = artist.rankAtChoice ? `Current rank at choice: #${artist.rankAtChoice}.` : 'This profile uses the artist data returned by the FIVE backend.';

  const instagram = normalizeUrl(artist.instagramUrl);
  const website = normalizeUrl(artist.websiteUrl);
  $('profileInstagram').href = instagram || '#';
  $('profileWebsite').href = website || '#';
  $('profileInstagram').classList.toggle('hidden', !instagram);
  $('profileWebsite').classList.toggle('hidden', !website);
  $('modal').classList.remove('hidden');
}

function closeProfile() {
  $('modal').classList.add('hidden');
  profileIndex = -1;
}

function chooseProfile() {
  if (profileIndex >= 0) {
    const index = profileIndex;
    closeProfile();
    choose(index);
  }
}

async function choose(index) {
  if (isRecording || !currentRound?.artists[index]) return;
  const artist = currentRound.artists[index];
  isRecording = true;
  document.querySelectorAll('.choose,#profileChoose').forEach(button => button.disabled = true);
  showMessage('playMessage', 'Recording your call...');

  const { error } = await supabaseClient.rpc('record_call', {
    p_round_id: currentRound.roundId,
    p_artist_id: artist.id,
    p_rank_at_choice: artist.rankAtChoice
  });

  isRecording = false;
  if (error) {
    document.querySelectorAll('.choose,#profileChoose').forEach(button => button.disabled = false);
    showMessage('playMessage', error.message, 'error');
    return;
  }

  currentRound.recordedArtistId = artist.id;
  $('chosen').textContent = artist.name;
  $('chosenMeta').textContent = label(artist.country, 'Country not listed');
  $('resultRank').textContent = artist.rankAtChoice ? `#${artist.rankAtChoice}` : 'Not provided';
  $('resultStatus').textContent = 'SAVED';
  await loadMyCalls();
  hideAll();
  $('result').classList.remove('hidden');
  updateAuthUI();
}

async function viewCalls() {
  if (!currentSession?.user) {
    authView('Sign in to see your calls.');
    return;
  }

  hideAll();
  $('calls').classList.remove('hidden');
  await loadMyCalls();
  renderCalls();
}

async function loadMyCalls() {
  if (!currentSession?.user) {
    myCalls = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from('calls')
    .select('id,created_at,rank_at_choice,artist_id,artists(id,name,country,instagram_url,website_url)')
    .eq('user_id', currentSession.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    myCalls = [];
    showMessage('callsMessage', error.message, 'error');
    updateAuthUI();
    return;
  }

  myCalls = data || [];
  updateAuthUI();
}

function renderCalls() {
  showMessage('callsMessage', '');
  $('activeLabel').textContent = `${myCalls.length} CALL${myCalls.length === 1 ? '' : 'S'}`;
  if (!myCalls.length) {
    $('callsList').innerHTML = '<div class="report"><h3>No calls yet.</h3><div class="small">Make your first call to start building a real history.</div></div>';
    return;
  }

  $('callsList').innerHTML = myCalls.map(call => {
    const artist = call.artists || {};
    const date = call.created_at ? new Date(call.created_at).toLocaleDateString() : 'Recorded';
    return `<div class="call-card"><div class="rank-old">${call.rank_at_choice ? `#${escapeHtml(call.rank_at_choice)}` : '-'}</div><div><div class="call-name">${escapeHtml(label(artist.name, 'Artist'))}</div><div class="call-country">${escapeHtml(label(artist.country, 'Country not listed'))} · ${escapeHtml(date)}</div></div><div class="rank-now developing">RECORDED</div></div>`;
  }).join('');
}

function eye() {
  hideAll();
  $('eye').classList.remove('hidden');
  renderEye();
}

function renderEye() {
  const count = myCalls.length;
  $('eyeCount').textContent = currentSession?.user ? `${count} REAL CALL${count === 1 ? '' : 'S'}` : 'SIGN IN';
  $('eyeHeadline').textContent = 'Not enough data yet.';
  $('eyeCopy').textContent = currentSession?.user
    ? 'FIVE is recording your choices, but this MVP will not invent scores before enough real ranking history exists.'
    : 'Sign in and make real calls to start building your eye.';
  $('metrics').innerHTML = ['EARLY', 'INDEPENDENT', 'EXPLORER'].map(name => `<div class="metric"><div class="metric-name">${name}</div><div class="metric-num">-</div><div class="metric-copy">Not enough real data yet.</div></div>`).join('');
  $('fiveList').innerHTML = '<div class="small" style="padding:15px 0">No measured artist pattern is available yet.</div>';
  $('bestCall').textContent = 'Not enough data yet.';
  $('bestCallCopy').textContent = 'Once the backend exposes enough real ranking history, this can show a measured result.';
}

function daily() {
  hideAll();
  $('daily').classList.remove('hidden');
  $('dailyStatus').textContent = 'Coming soon';
  $('dailyLabel').textContent = 'COMING SOON';
}

async function rankings() {
  hideAll();
  $('rankings').classList.remove('hidden');
  await renderRankings();
}

function normalizeRanking(row, index) {
  const artist = row.artist || row.artists || row;
  return {
    rank: row.rank || row.position || row.public_rank || index + 1,
    name: getArtistName(row),
    country: row.country || artist.country || row.artist_country || '',
    score: row.score || row.choice_share || row.calls_count || row.call_count || row.total_calls || null,
    scoreLabel: row.choice_share ? 'choice share' : row.score ? 'score' : 'calls'
  };
}

async function renderRankings() {
  $('rankList').innerHTML = '';
  showMessage('rankingMessage', 'Loading real rankings...');

  const { data, error } = await supabaseClient.rpc('get_public_rankings');
  if (error) {
    showMessage('rankingMessage', error.message, 'error');
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    $('rankingLabel').textContent = 'EMPTY';
    showMessage('rankingMessage', 'No public ranking data is available yet.');
    $('rankList').innerHTML = '<div class="report"><h3>No rankings yet.</h3><div class="small">Once real calls have been recorded and ranked by the backend, they will appear here.</div></div>';
    return;
  }

  showMessage('rankingMessage', '');
  $('rankingLabel').textContent = `${rows.length} ARTIST${rows.length === 1 ? '' : 'S'}`;
  $('rankList').innerHTML = rows.map((row, index) => {
    const item = normalizeRanking(row, index);
    return `<div class="rank-row"><div class="rank-num">#${escapeHtml(item.rank)}</div><div><div class="rank-artist">${escapeHtml(item.name)}</div><div class="rank-country">${escapeHtml(label(item.country, 'Country not listed'))}</div></div><div class="rank-choice">${escapeHtml(label(item.score, '-'))}</div><div class="rank-choice">${escapeHtml(item.scoreLabel)}</div></div>`;
  }).join('');
}

function submitArtist() {
  if (!currentSession?.user) {
    authView('Sign in to submit an artist.');
    return;
  }

  hideAll();
  $('submit').classList.remove('hidden');
  showMessage('submitMessage', '');
}

async function sendSubmission() {
  if (!currentSession?.user) {
    authView('Sign in to submit an artist.');
    return;
  }

  const name = $('artistName').value.trim();
  const country = $('artistCountry').value.trim();
  const instagramUrl = normalizeUrl($('artistInstagram').value);
  const websiteUrl = normalizeUrl($('artistWebsite').value);
  if (!name || !country || !instagramUrl || !websiteUrl) {
    showMessage('submitMessage', 'Name, country, Instagram URL, and website URL are required.', 'error');
    return;
  }

  setBusy('submitArtistButton', true, 'SENDING...');
  const { error } = await supabaseClient.from('artist_submissions').insert({
    user_id: currentSession.user.id,
    name,
    country,
    instagram_url: instagramUrl,
    website_url: websiteUrl
  });
  setBusy('submitArtistButton', false);

  if (error) {
    showMessage('submitMessage', error.message, 'error');
    return;
  }

  $('artistName').value = '';
  $('artistCountry').value = '';
  $('artistInstagram').value = '';
  $('artistWebsite').value = '';
  showMessage('submitMessage', 'Artist submitted for FIVE review.', 'success');
}

async function init() {
  if (!window.FIVE_SUPABASE_URL || !window.FIVE_SUPABASE_KEY) {
    authView('Supabase configuration is missing.');
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  currentSession = data.session;
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session;
    await loadMyCalls();
    updateAuthUI();
  });
  if (currentSession) await loadMyCalls();
  updateAuthUI();
  home();
}

window.home = home;
window.play = play;
window.eye = eye;
window.daily = daily;
window.rankings = rankings;
window.submitArtist = submitArtist;
window.authView = authView;
window.setAuthMode = setAuthMode;
window.submitAuth = submitAuth;
window.signOut = signOut;
window.nextRound = nextRound;
window.viewCalls = viewCalls;
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.chooseProfile = chooseProfile;
window.choose = choose;
window.sendSubmission = sendSubmission;

init();
