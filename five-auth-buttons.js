/* FIVE social authentication buttons — loaded after app.js */
(() => {
  const section = document.getElementById('auth');
  const actions = section?.querySelector('.auth-actions');
  if (!section || !actions || document.getElementById('fiveSocialAuth')) return;

  const style = document.createElement('style');
  style.textContent = `
    #fiveSocialAuth{margin-top:18px}
    #fiveSocialAuth .five-auth-divider{display:flex;align-items:center;gap:12px;margin:0 0 12px;color:#77736c;font-size:10px;letter-spacing:.13em}
    #fiveSocialAuth .five-auth-divider:before,#fiveSocialAuth .five-auth-divider:after{content:"";height:1px;background:#d6d2ca;flex:1}
    #fiveSocialAuth .five-auth-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    #fiveSocialAuth button{min-height:54px;width:100%;border:1px solid #111;background:transparent;color:#111;padding:12px 8px;font:10px Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
    #fiveSocialAuth button:disabled{opacity:.55;cursor:wait}
    #fiveSocialAuth button:hover{background:#e7e4dd}
    #fiveSocialAuth .five-auth-error{display:none;margin-top:12px;color:#7a3535;font-size:12px;line-height:1.4}
    @media(max-width:520px){#fiveSocialAuth .five-auth-buttons{grid-template-columns:1fr 1fr}#fiveSocialAuth button{font-size:9px;letter-spacing:.04em}}
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.id = 'fiveSocialAuth';
  wrap.innerHTML = `
    <div class="five-auth-divider">OR CONTINUE WITH</div>
    <div class="five-auth-buttons">
      <button type="button" id="fiveGoogleAuth">CONTINUE WITH GOOGLE</button>
      <button type="button" id="fiveAppleAuth">CONTINUE WITH APPLE</button>
    </div>
    <div class="five-auth-error" id="fiveSocialAuthError" role="status"></div>
  `;
  actions.insertAdjacentElement('afterend', wrap);

  const showError = text => {
    const el = document.getElementById('fiveSocialAuthError');
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
  };

  async function signIn(provider, id) {
    const btn = document.getElementById(id);
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'CONNECTING…';
    showError('');
    try {
      const url = window.FIVE_SUPABASE_URL;
      const key = window.FIVE_SUPABASE_KEY;
      if (!url || !key || !window.supabase?.createClient) throw new Error('Supabase configuration is missing.');
      const client = window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) throw error;
    } catch (e) {
      showError(e?.message || 'Unable to start sign-in. Please try again.');
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  document.getElementById('fiveGoogleAuth').addEventListener('click', () => signIn('google', 'fiveGoogleAuth'));
  document.getElementById('fiveAppleAuth').addEventListener('click', () => signIn('apple', 'fiveAppleAuth'));
})();
