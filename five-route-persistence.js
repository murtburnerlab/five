/* FIVE — preserve the active view across refresh and browser navigation. */
(() => {
  "use strict";
  const ROUTES = new Set(["home","auth","play","result","calls","eye","daily","rankings","submit","admin"]);
  const STORAGE = "five:last-route:v3";
  const RECOVERY_MARKER = "five:password-recovery:v1";
  let internal = false, lastRoute = null;
  const $ = id => document.getElementById(id);
  const visible = el => !!el && !el.classList.contains("hidden") && getComputedStyle(el).display !== "none";

  function hasRecoveryUrlSignal() {
    const q = new URLSearchParams(location.search);
    const hash = location.hash || "";
    return q.get("reset-password") === "1" ||
      hash.includes("type=recovery") || hash.includes("access_token=") ||
      hash.includes("refresh_token=") || hash.includes("code=");
  }
  function releaseRecoveryLock() {
    try { sessionStorage.removeItem(RECOVERY_MARKER); } catch (_) {}
  }
  function current(){ for(const id of ROUTES) if(visible($(id))) return id; return null; }
  function readHash(){ const v=(location.hash||"").slice(1); return v && !/[=&/]/.test(v) && ROUTES.has(v) ? v : null; }

  function setRoute(route, replace=false){
    if(!ROUTES.has(route) || hasRecoveryUrlSignal()) return;
    lastRoute=route;
    try{sessionStorage.setItem(STORAGE,route)}catch(_){}
    const hash="#"+route;
    if(location.hash!==hash){
      internal=true;
      if(replace) history.replaceState({fiveRoute:route},"",hash);
      else history.pushState({fiveRoute:route},"",hash);
      queueMicrotask(()=>internal=false);
    }
  }

  function go(route){
    if(!ROUTES.has(route)) return false;
    if(!hasRecoveryUrlSignal()) releaseRecoveryLock();
    if(route==="result"){
      try{if(!sessionStorage.getItem("five:last-result:v3")) route="play"}catch(_){route="play"}
    }
    if(route==="result"){
      document.querySelectorAll("main .view").forEach(el=>el.classList.add("hidden"));
      $("result")?.classList.remove("hidden"); restoreResult(); return true;
    }
    const map={home:()=>window.home?.(),auth:()=>window.authView?.(),play:()=>window.play?.(),calls:()=>window.viewCalls?.(),eye:()=>window.eye?.(),daily:()=>window.daily?.(),rankings:()=>window.rankings?.(),submit:()=>window.submitArtist?.(),admin:()=>window.openAdmin?.()};
    if(!map[route]) return false;
    map[route](); return true;
  }

  function restoreResult(){
    try{const d=JSON.parse(sessionStorage.getItem("five:last-result:v3")||"null");if(!d)return;
      for(const [id,key] of [["chosen","chosen"],["chosenMeta","meta"],["resultCount","count"],["nextCheck","next"],["progressCaption","caption"]]) if($(id)&&d[key]!=null) $(id).textContent=d[key];
      if($("resultProgress")&&d.progress)$("resultProgress").style.width=d.progress;
    }catch(_){}
  }

  function restore(){
    if(hasRecoveryUrlSignal()) {
      window.dispatchEvent(new CustomEvent("five:password-recovery-callback"));
      return;
    }
    releaseRecoveryLock();
    let route=readHash();
    if(!route){try{route=sessionStorage.getItem(STORAGE)}catch(_){}}
    if(!ROUTES.has(route))route="home";
    setTimeout(()=>{if(hasRecoveryUrlSignal())return;go(route);setRoute(route,true);restoreResult()},350);
  }

  function observe(){
    new MutationObserver(()=>{if(internal||hasRecoveryUrlSignal())return;const route=current();if(route&&route!==lastRoute)setRoute(route)})
      .observe(document.querySelector("main")||document.body,{subtree:true,attributes:true,attributeFilter:["class","style"]});
  }

  // Navigation uses inline handlers in index.html, so release stale recovery
  // state on deliberate navigation clicks before those handlers run.
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target || hasRecoveryUrlSignal()) return;
    const navIntent = target.closest("header button, .site-footer a, .home-actions button, .home-ranking-head button, .submit-promo-link");
    if (navIntent) releaseRecoveryLock();
  }, true);

  window.addEventListener("popstate",()=>{if(hasRecoveryUrlSignal())return;releaseRecoveryLock();const r=readHash();if(!r)return;internal=true;go(r);lastRoute=r;queueMicrotask(()=>internal=false)});
  window.addEventListener("hashchange",()=>{if(internal||hasRecoveryUrlSignal())return;releaseRecoveryLock();const r=readHash();if(r&&r!==current())go(r)});
  window.addEventListener("five:call-recorded",()=>{
    try{sessionStorage.setItem("five:last-result:v3",JSON.stringify({chosen:$("chosen")?.textContent||"",meta:$("chosenMeta")?.textContent||"",count:$("resultCount")?.textContent||"",next:$("nextCheck")?.textContent||"",progress:$("resultProgress")?.style.width||"10%",caption:$("progressCaption")?.textContent||""}))}catch(_){}
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{observe();restore()},{once:true});
  else {observe();restore()}
})();