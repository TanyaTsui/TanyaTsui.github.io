/* ============================================================
   EXHIBITION (KIOSK) MODE
   Adds class "kiosk" to <html> when the site runs full screen, so links
   that would leave the exhibition can be hidden or disabled (see the
   .kiosk rules in pages.css and play.html).

   Detected automatically for: browser full screen without a visible
   toolbar (F11, Ctrl+Cmd+F with "Always Show Toolbar" off, chrome --kiosk),
   and the site installed as a full-screen / home-screen app.
   Force it on for this browser with ?kiosk (remembered), off with ?kiosk=off.
   Loaded in <head> so the page never flashes the links before hiding them.
   ============================================================ */
(function(){
  var KEY = 'factorySiting.kiosk';
  var root = document.documentElement;
  var forced = false;

  try{
    var param = new URLSearchParams(location.search).get('kiosk');
    if(param !== null){
      if(param === 'off' || param === '0') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, '1');
    }
    forced = localStorage.getItem(KEY) === '1';
  }catch(e){ /* storage blocked: rely on detection only */ }

  function fullScreenNow(){
    var mq = function(q){ return window.matchMedia && window.matchMedia(q).matches; };
    if(mq('(display-mode: fullscreen)') || mq('(display-mode: standalone)')) return true;
    if(window.navigator.standalone) return true;          // iOS home-screen app
    if(document.fullscreenElement) return true;
    // browser full screen with no toolbar: the page fills the whole screen
    return Math.abs(window.innerWidth - screen.width) <= 2 &&
           Math.abs(window.innerHeight - screen.height) <= 2;
  }

  function update(){
    var on = forced || fullScreenNow();
    root.classList.toggle('kiosk', on);
    // keep disabled links out of the keyboard tab order too
    var links = document.querySelectorAll('a[href^="http"], a[href^="../"], a[target="_blank"]');
    for(var i=0;i<links.length;i++){
      if(on){ links[i].setAttribute('tabindex','-1'); links[i].setAttribute('aria-disabled','true'); }
      else { links[i].removeAttribute('tabindex'); links[i].removeAttribute('aria-disabled'); }
    }
  }

  update();
  document.addEventListener('DOMContentLoaded', update);
  window.addEventListener('resize', update);
  document.addEventListener('fullscreenchange', update);
})();
