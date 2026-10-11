/* FIVE recovery hotfix bootstrap.
 * Loads the complete, known-good FIVE app source from an immutable Git commit,
 * then loads the recovery module only after the Supabase client exists.
 * Replaces the broken bootstrap that referenced a non-existent commit SHA.
 */
(async function () {
  'use strict';
  const BASE = 'https://raw.githubusercontent.com/murtburnerlab/five/1c638e40422db9c18d0adf0a8b6e68e1b67e1b7e/';
  function loadClassic(source, label) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([source + '\n//# sourceURL=' + label], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => { URL.revokeObjectURL(url); resolve(); };
      script.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not execute ' + label)); };
      document.head.appendChild(script);
    });
  }
  async function fetchText(path) {
    const response = await fetch(BASE + path, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load ' + path + ' (' + response.status + ')');
    return response.text();
  }
  try {
    let app = await fetchText('app.js');
    // The original app routes using the hash and ignores the recovery query.
    // Preserve the reset URL flag so the recovery module can identify the flow.
    await loadClassic(app, 'five-original-app.js');
    // Ensure recovery initializes after the original app has created its client.
    const recovery = await fetchText('five-password-recovery.js');
    await loadClassic(recovery, 'five-password-recovery.js');
  } catch (error) {
    console.error('FIVE startup failed:', error);
    const notice = document.createElement('div');
    notice.style.cssText = 'padding:20px;font:14px Arial;background:#f1efe9;color:#111';
    notice.textContent = 'FIVE could not start. Check your connection and refresh the page.';
    document.body.prepend(notice);
  }
})();
