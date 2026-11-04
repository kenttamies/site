// Shared by every page. The build puts this in front of each page's own script.

function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function forget(key) { try { localStorage.removeItem(key); } catch (e) {} }

// Google Analytics loads only after the visitor says yes to "cookies?".
var GA_ID = 'G-GM8S45TN7F';

function startTracking() {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_ID);
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
}

function track(name, params) {
  if (window.gtag) gtag('event', name, params || {});
}

// Shows "cookies?" if it hasn't been answered. onTracking runs once tracking is on.
function consent(onTracking) {
  var answer = load('cookies');
  var ask = document.getElementById('ask');
  if (answer === 'yes') {
    startTracking();
    onTracking();
  } else if (answer !== 'no') {
    ask.hidden = false;
  }
  document.getElementById('yes').addEventListener('click', function () {
    save('cookies', 'yes');
    ask.hidden = true;
    startTracking();
    onTracking();
  });
  document.getElementById('no').addEventListener('click', function () {
    save('cookies', 'no');
    ask.hidden = true;
  });
}

// phones and tablets (iPads report as Macs, so check for touch too)
function onMobile() {
  var ua = navigator.userAgent || '';
  return !!((navigator.userAgentData && navigator.userAgentData.mobile) ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
}

function pad(v) {
  var s = String(Math.abs(v)).padStart(6, '0');
  return v < 0 ? '-' + s : s;
}

function renderCounter(el, label) {
  el.innerHTML = label.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('');
  el.setAttribute('aria-label', label);
}

// "Done" is stored per level as l1done, l2done, ... and never cleared,
// so finished levels stay finished when a level is replayed or new levels are added.
function levelDone(n) {
  if (load('l' + n + 'done') === '1') return true;
  // older saves, from before the done flags existed
  var old = false;
  if (n === 1) old = (parseInt(load('visits'), 10) || 0) >= 105;
  if (n === 2) { try { old = JSON.parse(load('l2')).phase === 'solved'; } catch (e) {} }
  if (old) markDone(n);
  return old;
}
function markDone(n) { save('l' + n + 'done', '1'); }

// Level 3 opens at 10:00 Swedish time on 24 October 2026. Sweden is still on summer time
// (UTC+2) then, so that's 08:00 UTC. Test copies set "l3early" to play before then.
var L3_RELEASE = Date.UTC(2026, 9, 24, 8, 0, 0);
function level3Open() { return Date.now() >= L3_RELEASE || load('l3early') === '1'; }
// time left as "1d 02:13:45", or "02:13:45" under a day
function untilRelease() {
  var t = Math.max(0, Math.floor((L3_RELEASE - Date.now()) / 1000));
  var d = Math.floor(t / 86400), h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60, s = t % 60;
  var hms = [h, m, s].map(function (x) { return String(x).padStart(2, '0'); }).join(':');
  return (d ? d + 'd ' : '') + hms;
}
function level1Done() { return levelDone(1); }

// One-shot flags that survive a single reload, so "continue" and "start over"
// aren't mistaken for a refresh on the page they reload.
function takeFlag(key) {
  try { var v = sessionStorage.getItem(key); sessionStorage.removeItem(key); return v === '1'; } catch (e) { return false; }
}
function setFlag(key) { try { sessionStorage.setItem(key, '1'); } catch (e) {} }

// Coming back to a level part-way through: a greeting with "continue" and "start over".
// onStartOver clears that level's progress before the reload.
function offerResume(level, text, onStartOver) {
  document.getElementById('msg').textContent = text;
  var start = document.getElementById('start');
  var resume = document.getElementById('resume');
  start.textContent = 'start over';
  start.hidden = false;
  resume.hidden = false;
  resume.addEventListener('click', function () { setFlag('l' + level + 'continue'); location.reload(); });
  start.addEventListener('click', function () {
    track('level_restart', { level: level });
    onStartOver();
    setFlag('l' + level + 'start');
    location.reload();
  });
  consent(function () { track('level_resume_view', { level: level }); });
}

// true when the page was opened (from the picker, a link or typed in), false when it was refreshed.
// Worked out once per page load. The "navigated" flag is set by the single-file test copy,
// which switches pages by reloading.
var OPENED_FRESH = (function () {
  if (takeFlag('navigated')) return true;
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    return !nav || nav.type !== 'reload';
  } catch (e) { return true; }
})();
function openedFresh() { return OPENED_FRESH; }
