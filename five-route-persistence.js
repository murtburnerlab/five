/* FIVE — preserve active view on refresh without trapping users in recovery mode. */
(() => {
  "use strict";
  const ROUTES = new Set(["home","auth","play","result","calls","eye","daily","rankings","submit","admin"]);
  const STORAGE = "five:last-route:v3";
  const MARKER = "five:password-recovery:v1";
  let internal = false, lastRoute = null;
  const $ = id => document.getElementById(id);
  const visible = el => !!el && !el.classList.contains("hidden") && getComputedStyle(el).display !== "none";

  function hasRecoveryCallbackInUrl() {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    // A reset marker alone must not block routing. It only counts when a real
    // one-time Supabase callback is present in the URL.
    return (q.get("reset-password") === "1" && q.has("code")) ||
      h.get("type") === "recovery" || h.has("access_token") || h.has("refresh_token");
  }
  function releaseRecoveryLock() {
    try { sessionStorage.removeItem(MARKER); } catch (_) {}
    window.dispatchEvent(new CustomEvent("five:leave-password-recovery"));
  }
  function current() {
    for (const id of ROUTES) if (visible($(id))) return id;
    return null;
  }
  function readHash() {
    const v = (location.hash || "").slice(1);
    return v && !/[=&/]/.test(v) && ROUTES.has(v) ? v : null;
  }
  function setRoute(route, replace=false) {
    if (!ROUTES.has(route) || hasRecoveryCallbackInUrl()) return;
    lastRoute = route;
    try { sessionStorage.setItem(STORAGE, route); } catch (_) {}
    const hash = "#" + route;
    if (location.hash !== hash) {
      internal = true;
      if (replace) history.replaceState({fiveRoute:route}, "", hash);
      else history.pushState({fiveRoute:route}, "", hash);
      queueMicrotask(() => { internal = false; });
    }
  }
  function restoreResult() {
    try {
      const d = JSON.parse(sessionStorage.getItem("five:last-result:v3") || "null");
      if (!d) return;
      for (const [id,key] of [["chosen","chosen"],["chosenMeta","meta"],["resultCount","count"],["nextCheck","next"],["progressCaption","caption"]]) {
        if ($(id) && d[key] != null) $(id).textContent = d[key];
      }
      if ($("resultProgress") && d.progress) $("resultProgress").style.width = d.progress;
    } catch (_) {}
  }
  function go(route) {
    if (!ROUTES.has(route)) return false;
    releaseRecoveryLock();
    if (route === "result") {
      try { if (!sessionStorage.getItem("five:last-result:v3")) route = "play"; }
      catch (_) { route = "play"; }
    }
    if (route === "result") {
      document.querySelectorAll("main .view").forEach(el => el.classList.add("hidden"));
      $("result")?.classList.remove("hidden");
      restoreResult();
      return true;
    }
    const map = {
      home:()=>window.home?.(), auth:()=>window.authView?.(), play:()=>window.play?.(),
      calls:()=>window.viewCalls?.(), eye:()=>window.eye?.(), daily:()=>window.daily?.(),
      rankings:()=>window.rankings?.(), submit:()=>window.submitArtist?.(), admin:()=>window.openAdmin?.()
    };
    if (!map[route]) return false;
    map[route]();
    return true;
  }
  function restore() {
    if (hasRecoveryCallbackInUrl()) {
      window.dispatchEvent(new CustomEvent("five:password-recovery-callback"));
      return;
    }
    // The callback URL may already have been cleaned by Supabase. If the
    // pre-client redirect script preserved the marker, let the recovery flow
    // finish instead of restoring the last route and clearing that marker.
    try {
      if (sessionStorage.getItem(MARKER) === "1") {
        window.dispatchEvent(new CustomEvent("five:password-recovery-callback"));
        return;
      }
    } catch (_) {}
    releaseRecoveryLock();
    let route = readHash();
    if (!route) { try { route = sessionStorage.getItem(STORAGE); } catch (_) {} }
    if (!ROUTES.has(route)) route = "home";
    setTimeout(() => {
      if (hasRecoveryCallbackInUrl()) return;
      go(route);
      setRoute(route, true);
      restoreResult();
    }, 350);
  }
  function observe() {
    new MutationObserver(() => {
      if (internal || hasRecoveryCallbackInUrl()) return;
      const route = current();
      if (route && route !== lastRoute) setRoute(route);
    }).observe(document.querySelector("main") || document.body, {
      subtree:true, attributes:true, attributeFilter:["class","style"]
    });
  }
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target || hasRecoveryCallbackInUrl()) return;
    const navIntent = target.closest("header button, .site-footer a, .home-actions button, .home-ranking-head button, .submit-promo-link");
    if (navIntent) releaseRecoveryLock();
  }, true);
  window.addEventListener("popstate", () => {
    if (hasRecoveryCallbackInUrl()) return;
    releaseRecoveryLock();
    const route = readHash();
    if (!route) return;
    internal = true;
    go(route);
    lastRoute = route;
    queueMicrotask(() => { internal = false; });
  });
  window.addEventListener("hashchange", () => {
    if (internal || hasRecoveryCallbackInUrl()) return;
    const route = readHash();
    if (route) { releaseRecoveryLock(); go(route); lastRoute = route; }
  });
  window.addEventListener("five:password-recovery-callback", () => {
    // Recovery UI is owned by five-password-recovery.js; do not force a route.
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { restore(); observe(); }, {once:true});
  else { restore(); observe(); }
})();
