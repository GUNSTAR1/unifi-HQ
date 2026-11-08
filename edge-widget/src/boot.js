// Lagezentrum – iCUE widget for the CORSAIR XENEON EDGE.
// Reads the widget settings from iCUE, hands them to the dashboard as window.LZ_REMOTE and then
// loads globe.gl and app.js (the same dashboard the server ships under web/).
// Also runs in a plain browser: index.html?server=10.0.0.5:8080&key=… (no server = demo data).

function getIcueProperty(name) {
  if (Object.prototype.hasOwnProperty.call(window, name)) {
    const v = window[name];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  try {
    const v = Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined')();
    if (v !== undefined && v !== null && v !== '') return v;
  } catch (e) {}
  return undefined;
}
const asBool = (v, d) => (v === undefined ? d : v === true || v === 'true' || v === 1 || v === '1');
const oneOf = (v, list, d) => (v !== undefined && list.includes(String(v)) ? String(v) : d);

// The iCUE properties as one string, so onDataUpdated can tell a real change from a repeat
const PROPS = ['serverUrl', 'widgetKey', 'mapView', 'colorScheme', 'autoRotate', 'showStats', 'showTicker', 'liteMode'];
const propSnapshot = () => JSON.stringify(PROPS.map((p) => { const v = getIcueProperty(p); return v === undefined ? null : String(v); }));

let booted = false, bootProps = '';
function onIcueInitialized() {
  if (booted) return;
  booted = true;
  bootProps = propSnapshot();
  const q = new URLSearchParams(location.search);
  const pick = (param, prop) => (q.has(param) ? q.get(param) : getIcueProperty(prop));
  const base = String(pick('server', 'serverUrl') || '').trim();
  window.LZ_REMOTE = {
    base,
    key: String(pick('key', 'widgetKey') || '').trim(),
    demo: !base || q.has('demo'),
    lite: asBool(pick('lite', 'liteMode'), false),
    settings: {
      view: oneOf(pick('view', 'mapView'), ['globe', 'flat'], 'globe'),
      theme: oneOf(pick('theme', 'colorScheme'), ['navy', 'graphite', 'black'], 'navy'),
      autoRotate: asBool(getIcueProperty('autoRotate'), true),
      showLeft: asBool(getIcueProperty('showStats'), true),
      showRight: asBool(getIcueProperty('showTicker'), true),
    },
  };
  // nacheinander laden: app.js braucht Globe
  const load = (src, next) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = next;
    s.onerror = next; // app.js meldet selbst, wenn die 3D-Bibliothek fehlt
    document.body.appendChild(s);
  };
  load('vendor/globe.gl.min.js', () => load('app.js'));
}

// Settings changed in iCUE: restart with the new values. iCUE also fires this at start-up and
// now and then without any change, so only reload when a value really differs (else: reload loop).
let reloadTimer = 0;
function onIcueDataUpdated() {
  if (!booted || propSnapshot() === bootProps) return;
  clearTimeout(reloadTimer); // typing in a text field fires once per key: wait until it settles
  reloadTimer = setTimeout(() => { if (propSnapshot() !== bootProps) location.reload(); }, 1500);
}

let bootAttempts = 0;
function bootCheck() {
  if (typeof iCUE_initialized !== 'undefined' && iCUE_initialized) { onIcueInitialized(); return; }
  if (bootAttempts++ < 15) { setTimeout(bootCheck, 100); return; }
  onIcueInitialized(); // plain browser
}
bootCheck();
