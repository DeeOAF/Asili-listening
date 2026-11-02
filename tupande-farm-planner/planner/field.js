/* Tupande Farm Planner: step 1 field mapping.
   Three ways in (spec 4.1–4.2):
   - walk: stand at each corner and tap; GPS fixes are averaged and saved only at 10 m or better.
   - tap: tap the corners on the satellite map.
   - steps: step out length and width (or type acres) when GPS cannot be used.
   After a walk, corners can be fine-tuned on the map when imagery is available. */
(function () {
  'use strict';
  var C = window.TupandeCalc;
  var GOOD_ACCURACY_M = 10;
  var CAPTURE_MS = window.__plannerCaptureMs || 10000; // time spent averaging each corner
  var MAX_WAIT_MS = window.__plannerMaxWaitMs || Math.max(25000, CAPTURE_MS * 2.5); // give up on a corner after this
  var MIN_FIXES = 3;
  var KAKAMEGA = [0.2827, 34.7519];

  var getState, changed;
  var map, poly, handles = [], youDot, tileErrors = 0, tileLoads = 0, imageryFailed = false;
  var watchId = null, lastFix = null, capturing = false, wakeLock = null, mapLocked = false;

  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function f() { return getState().field; }
  function nf(v) { return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(v)); }
  function ac(v) { return (Math.round(v * 100) / 100).toFixed(2) + (Math.abs(v - 1) < 0.005 ? ' acre' : ' acres'); }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* no vibration */ } }
  function status(msg) { var el = $('#gpsStatus'); el.textContent = msg || ''; el.hidden = !msg; }
  function msg(text, bad) { var el = $('#walkMsg'); el.textContent = text || ''; el.classList.toggle('bad', !!bad); }
  function unconfirm() { f().confirmed = false; }

  // Switching method clears corners already marked; ask first.
  function keepCorners() {
    var n = (f().points || []).length;
    return !n || window.confirm('Switch method? The ' + n + (n === 1 ? ' corner' : ' corners') + ' you have marked will be cleared.');
  }

  /* ---------- Shared GPS watch ---------- */
  function startWatch() {
    if (watchId !== null) return true;
    if (!navigator.geolocation) return false;
    watchId = navigator.geolocation.watchPosition(function (pos) {
      lastFix = pos; renderMeter(); renderYou();
      if (f().source === 'walk') renderPreview();
    }, function (err) {
      if (err && err.code === 1) { stopWatch(); openSteps('Location permission was refused. Step out the field instead.'); }
      else $('#gpsMeterText').textContent = 'Looking for GPS… Stand in the open, away from trees and buildings.';
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    return true;
  }
  function stopWatch() { if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); watchId = null; }

  function requestWake() {
    try { if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () { /* not allowed */ }); } catch (e) { /* unsupported */ }
  }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* already released */ } wakeLock = null; }

  /* ---------- Map (optional: needs mobile data for imagery) ---------- */
  function ensureMap(center, zoom) {
    if (!window.L || imageryFailed) return false;
    $('#mapWrap').hidden = false;
    if (!map) {
      map = L.map('map', { zoomControl: true, attributionControl: true }).setView(center, zoom);
      var layer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
      });
      layer.on('tileload', function () { tileLoads++; });
      layer.on('tileerror', function () {
        tileErrors++;
        if (tileLoads === 0 && tileErrors === 4) imageryUnavailable();
      });
      layer.addTo(map);
      map.on('click', function (e) {
        var fl = f();
        if (fl.source !== 'tap' || (fl.points || []).length >= 6) return;
        fl.points = (fl.points || []).concat([[e.latlng.lat, e.latlng.lng]]);
        unconfirm(); buzz(30); drawShape(); changed();
      });
    } else map.setView(center, zoom);
    setTimeout(function () { map.invalidateSize(); }, 60);
    return true;
  }

  function imageryUnavailable() {
    imageryFailed = true;
    $('#mapWrap').hidden = true;
    var src = f().source;
    if (src === 'tap') status('The satellite picture is not loading. Walk the corners instead (it works without mobile data), or step out the sides.');
    else if (src === 'walk') status('The satellite picture is not loading, so the corners are shown as a sketch. Walking still works.');
  }

  function drawShape() {
    if (!map) return;
    var fl = f(), pts = fl.points || [];
    if (poly) { poly.remove(); poly = null; }
    handles.forEach(function (h) { h.remove(); }); handles = [];
    if (pts.length >= 2) poly = (pts.length >= 3 ? L.polygon : L.polyline)(pts, { color: '#E8B757', weight: 3, fillColor: '#E8B757', fillOpacity: 0.18 }).addTo(map);
    var draggable = fl.source === 'tap' || fl.source === 'gps' || (fl.source === 'walk' && fl.walkDone);
    pts.forEach(function (p, i) {
      var h = L.marker(p, { draggable: draggable, keyboard: true, title: 'Corner ' + (i + 1),
        icon: L.divIcon({ className: 'corner-handle', html: '<span>' + (i + 1) + '</span>', iconSize: [36, 36] }) }).addTo(map);
      h.on('drag', function (e) {
        var ll = e.target.getLatLng();
        fl.points[i] = [ll.lat, ll.lng];
        if (poly) poly.setLatLngs(fl.points);
        unconfirm(); renderMeasure();
      });
      h.on('dragend', function () { buzz(30); changed(); });
      handles.push(h);
    });
  }

  function renderYou() {
    if (!map || !lastFix) return;
    var ll = [lastFix.coords.latitude, lastFix.coords.longitude];
    if (!youDot) youDot = L.circleMarker(ll, { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#2F6067', fillOpacity: 1, interactive: false }).addTo(map);
    else youDot.setLatLng(ll);
  }

  function toggleLock() {
    mapLocked = !mapLocked;
    if (map) { if (mapLocked) map.dragging.disable(); else map.dragging.enable(); }
    $('#lockMap').setAttribute('aria-pressed', mapLocked);
    $('#lockMap').textContent = mapLocked ? 'Unlock map' : 'Lock map';
  }

  /* ---------- Walk the corners ---------- */
  function startWalk() {
    var fl = f();
    if (fl.source !== 'walk') {
      if (!keepCorners()) return;
      fl.source = 'walk'; fl.points = []; fl.accuracies = []; fl.walkDone = false; drawShape();
    }
    unconfirm(); status('');
    if (!startWatch()) { openSteps('This device cannot share its location. Step out the field instead.'); return; }
    requestWake();
    msg('Go to the first corner of the field, then tap "Mark corner 1".');
    navigator.geolocation.getCurrentPosition(function (pos) {
      lastFix = pos; renderMeter();
      if (ensureMap([pos.coords.latitude, pos.coords.longitude], 18)) { renderYou(); drawShape(); }
    }, function () { /* the watch reports problems */ }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    changed();
  }

  function renderMeter() {
    var el = $('#gpsMeter'), t = $('#gpsMeterText');
    if (!lastFix) { el.className = 'gps-meter'; t.textContent = 'Looking for GPS…'; return; }
    var acc = Math.round(lastFix.coords.accuracy), ok = acc <= GOOD_ACCURACY_M, pts = f().points || [];
    var dist = pts.length ? ' · ' + nf(C.distanceM(pts[pts.length - 1], [lastFix.coords.latitude, lastFix.coords.longitude])) + ' m from corner ' + pts.length : '';
    el.className = 'gps-meter ' + (ok ? 'ok' : 'wait');
    t.textContent = ok ? 'GPS accurate to about ' + acc + ' m. Ready' + dist
                       : 'GPS accurate to about ' + acc + ' m. Waiting for 10 m or better' + dist;
  }

  function markCorner() {
    if (capturing) return;
    var fl = f();
    if ((fl.points || []).length >= 6) return;
    capturing = true;
    var start = Date.now(), good = [], best = Infinity;
    $('#capture').hidden = false; $('#markCorner').disabled = true;
    msg('');
    function progress() {
      var el = Date.now() - start;
      $('#captureBar').style.width = Math.min(100, el / CAPTURE_MS * 100) + '%';
      $('#captureText').textContent = good.length < MIN_FIXES && el >= CAPTURE_MS
        ? 'Waiting for a better GPS signal… best so far ' + (isFinite(best) ? Math.round(best) + ' m' : 'none')
        : 'Hold still at the corner… ' + Math.max(0, Math.ceil((CAPTURE_MS - el) / 1000)) + ' s';
    }
    function finish(ok) {
      capturing = false;
      $('#capture').hidden = true; $('#markCorner').disabled = false;
      if (!ok) {
        buzz([80, 60, 80]);
        msg('GPS was not accurate enough here (best ' + (isFinite(best) ? Math.round(best) + ' m' : 'no signal') + '). Stand in the open, away from trees and buildings, and try again.', true);
        return;
      }
      var fix = C.averageFix(good), pts = fl.points || [];
      var near = pts.length ? C.distanceM(pts[pts.length - 1], [fix.lat, fix.lng]) : Infinity;
      if (near < 3) { buzz([80, 60, 80]); msg('This is less than 3 m from corner ' + pts.length + '. Walk to the next corner first.', true); return; }
      fl.points = pts.concat([[fix.lat, fix.lng]]);
      fl.accuracies = (fl.accuracies || []).concat([fix.accuracyM]);
      unconfirm(); buzz(150);
      var n = fl.points.length;
      msg('Corner ' + n + ' saved, accurate to about ' + Math.round(fix.accuracyM) + ' m. ' +
        (n < 4 ? 'Walk to corner ' + (n + 1) + '.' : n < 6 ? 'Walk to the next corner, or tap "Finish field" if this was the last one.' : 'That is six corners. Tap "Finish field".'));
      drawShape(); changed();
    }
    /* Sample the latest fix from the running watch about once a second, using only fixes
       under 5 s old, and nudge the phone for a fresh fix each time. */
    var asking = false;
    (function tick() {
      if (!capturing) return;
      var el = Date.now() - start;
      if (el >= CAPTURE_MS && good.length >= MIN_FIXES) return finish(true);
      if (el >= MAX_WAIT_MS) return finish(false);
      if (lastFix && Date.now() - lastFix.timestamp <= 5000) {
        best = Math.min(best, lastFix.coords.accuracy);
        if (lastFix.coords.accuracy <= GOOD_ACCURACY_M) good.push({ lat: lastFix.coords.latitude, lng: lastFix.coords.longitude, accuracy: lastFix.coords.accuracy });
      }
      if (!asking) {
        asking = true;
        navigator.geolocation.getCurrentPosition(function (p) { asking = false; lastFix = p; renderMeter(); }, function () { asking = false; },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 4000 });
      }
      progress();
      setTimeout(tick, 800);
    })();
  }

  function undoCorner() {
    var fl = f();
    if (!fl.points || !fl.points.length) return;
    fl.points = fl.points.slice(0, -1);
    if (fl.accuracies) fl.accuracies = fl.accuracies.slice(0, fl.points.length);
    fl.walkDone = false; unconfirm();
    msg(fl.points.length ? 'Corner removed. Mark corner ' + (fl.points.length + 1) + ' again.' : 'Go to the first corner of the field.');
    drawShape(); changed();
  }

  function finishWalk() {
    var fl = f();
    if ((fl.points || []).length < 4) return;
    fl.walkDone = true;
    releaseWake(); stopWatch();
    var m = measure();
    msg(m && m.valid ? 'Field finished. Check the size below' + (map && !imageryFailed ? ', drag any corner on the map to fine-tune it,' : '') + ' then confirm.' : '', false);
    if (map && !imageryFailed) { var c = centroid(fl.points); map.setView(c, 18); }
    drawShape(); changed();
  }

  function centroid(pts) { return pts.reduce(function (a, p) { return [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length]; }, [0, 0]); }

  // Sketch of the walked corners; works without imagery.
  function renderPreview() {
    var el = $('#walkPreview'), fl = f(), pts = (fl.points || []).slice();
    var you = lastFix && !fl.walkDone ? [lastFix.coords.latitude, lastFix.coords.longitude] : null;
    if (!pts.length) { el.innerHTML = ''; return; }
    var all = you ? pts.concat([you]) : pts, xy = C.project(all).map(function (p) { return [p[0], -p[1]]; });
    var minX = Math.min.apply(null, xy.map(function (p) { return p[0]; })), maxX = Math.max.apply(null, xy.map(function (p) { return p[0]; }));
    var minY = Math.min.apply(null, xy.map(function (p) { return p[1]; })), maxY = Math.max.apply(null, xy.map(function (p) { return p[1]; }));
    var W = 320, H = 180, pad = 22, s = Math.min((W - 2 * pad) / Math.max(maxX - minX, 20), (H - 2 * pad) / Math.max(maxY - minY, 20));
    var ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
    var P = xy.map(function (p) { return [ox + (p[0] - minX) * s, oy + (p[1] - minY) * s]; });
    var corners = P.slice(0, pts.length), out = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    if (corners.length >= 2) {
      out += '<polyline points="' + corners.map(function (p) { return p.join(','); }).join(' ') + '" fill="none" stroke="#22302D" stroke-width="2.5" stroke-linejoin="round"/>';
      out += '<line x1="' + corners[corners.length - 1][0] + '" y1="' + corners[corners.length - 1][1] + '" x2="' + corners[0][0] + '" y2="' + corners[0][1] + '" stroke="#22302D" stroke-width="2" stroke-dasharray="5 5"' + (fl.walkDone ? '' : ' opacity=".45"') + '/>';
    }
    corners.forEach(function (p, i) {
      out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="#E8B757" stroke="#22302D" stroke-width="2.5"/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" text-anchor="middle" font-family="Georama, Arial, sans-serif" font-weight="800" font-size="11" fill="#22302D">' + (i + 1) + '</text>';
    });
    if (you) { var y = P[P.length - 1]; out += '<circle cx="' + y[0] + '" cy="' + y[1] + '" r="7" fill="#2F6067" stroke="#FFFFFF" stroke-width="3"/>'; }
    el.innerHTML = out + '</svg>';
  }

  /* ---------- Tap corners on the map ---------- */
  function startTap() {
    var fl = f();
    if (fl.source !== 'tap' && fl.source !== 'gps') {
      if (!keepCorners()) return;
      fl.source = 'tap'; fl.points = []; fl.walkDone = false; drawShape();
    }
    unconfirm(); msg('');
    if (!window.L || imageryFailed) { status('The satellite picture is not available. Walk the corners instead, or step out the sides.'); changed(); return; }
    status('Finding your location…');
    var placed = false;
    function place(center, zoom, note) { if (placed) return; placed = true; status(note); if (ensureMap(center, zoom)) { renderYou(); drawShape(); } changed(); }
    if (navigator.geolocation) {
      startWatch();
      navigator.geolocation.getCurrentPosition(function (pos) {
        lastFix = pos;
        place([pos.coords.latitude, pos.coords.longitude], 18, '');
      }, function () { place(KAKAMEGA, 14, 'Your location could not be found. Move the map to the field.'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    } else place(KAKAMEGA, 14, 'Move the map to the field.');
  }

  /* ---------- Step out the sides ---------- */
  function openSteps(why) {
    var fl = f();
    fl.source = 'steps';
    fl.steps = fl.steps || { unit: 'steps', length: null, width: null, stepM: 0.75, acres: null };
    unconfirm(); releaseWake();
    $('#mapWrap').hidden = true; status('');
    if (why) $('#manualWhy').textContent = why + ' Walk along one long side and one short side, counting normal steps.';
    changed();
  }

  /* ---------- Measuring ---------- */
  function measure() {
    var fl = f(), src = fl.source;
    if ((src === 'walk' && fl.walkDone) || src === 'tap' || src === 'gps') {
      if (!fl.points || fl.points.length < 4) return null;
      var m = C.measureField(fl.points);
      if (src === 'walk' && fl.accuracies && fl.accuracies.length) {
        m.plusMinus = C.areaUncertaintyAcres(fl.points, fl.accuracies);
      }
      return m;
    }
    if (src === 'steps' && fl.steps) {
      var st = fl.steps;
      if (st.unit === 'acres') return st.acres > 0 ? { acres: st.acres, perimeterM: C.squarePerimeter(st.acres), valid: true, problem: '', square: true } : null;
      if (!(st.length > 0 && st.width > 0)) return null;
      var k = st.unit === 'steps' ? st.stepM || 0.75 : 1, r = C.rectangleField(st.length * k, st.width * k);
      return { acres: r.acres, perimeterM: r.perimeterM, valid: r.acres >= 0.01, problem: r.acres >= 0.01 ? '' : 'The field is too small to plan. Check the length and width.', rect: true };
    }
    if (src === 'manual' && fl.acres > 0) return { acres: fl.acres, perimeterM: C.squarePerimeter(fl.acres), valid: true, problem: '', square: true };
    return null;
  }

  function renderMeasure() {
    var m = measure(), fl = f();
    $('#measure').hidden = !m;
    $('#fieldProblem').hidden = !(m && !m.valid);
    if (m) {
      $('#mAcres').textContent = (m.plusMinus ? 'about ' : '') + ac(m.acres);
      $('#mPlusMinus').textContent = m.plusMinus ? 'give or take ' + (Math.round(m.plusMinus * 100) / 100).toFixed(2) + ' acres, because of GPS accuracy' : m.square ? 'boundary estimated as a square' : m.rect ? 'treated as a rectangle' : '';
      $('#mPerim').textContent = nf(m.perimeterM) + ' m';
      $('#fieldProblem').textContent = m.problem;
    }
    $('#confirmField').disabled = !(m && m.valid) || fl.confirmed;
    $('#fieldOk').hidden = !fl.confirmed;
  }

  function confirmField() {
    var m = measure(), fl = f();
    if (!m || !m.valid) return;
    fl.acres = Math.round(m.acres * 1000) / 1000;
    fl.perimeterM = m.perimeterM;
    fl.confirmed = true;
    buzz(60); changed();
  }

  /* ---------- Render and wiring ---------- */
  function render() {
    var fl = f(), src = fl.source, pts = fl.points || [];
    $('#methodWalk').setAttribute('aria-pressed', src === 'walk');
    $('#methodTap').setAttribute('aria-pressed', src === 'tap' || src === 'gps');
    $('#walkPanel').hidden = src !== 'walk';
    $('#manual').hidden = src !== 'steps' && src !== 'manual';
    if (src !== 'tap' && src !== 'gps' && !(src === 'walk' && map && !imageryFailed)) $('#mapWrap').hidden = true;

    if (src === 'walk') {
      var n = pts.length;
      $('#markCorner').textContent = fl.walkDone ? 'Field finished' : n >= 6 ? 'Six corners marked' : 'Mark corner ' + (n + 1);
      $('#markCorner').disabled = capturing || fl.walkDone || n >= 6;
      $('#finishWalk').disabled = n < 4 || fl.walkDone;
      $('#undoCorner').disabled = !n || capturing;
      $('#cornerList').innerHTML = pts.map(function (p, i) {
        var a = fl.accuracies && fl.accuracies[i];
        return '<li><span>Corner ' + (i + 1) + '</span><span>' + (a ? 'about ' + Math.round(a) + ' m' : '') + '</span></li>';
      }).join('');
      $('#gpsMeter').hidden = !!fl.walkDone;
      renderPreview();
    }
    var tapping = src === 'tap' || src === 'gps';
    $('#mapHelp').textContent = tapping
      ? (pts.length < 4 ? 'Tap each corner of the field on the map, going round in order. ' + pts.length + ' of 4 to 6 corners.' : pts.length + ' corners. Drag a corner to adjust it, tap to add up to 6, or confirm below.')
      : 'Drag any corner to fine-tune it against the satellite picture.';
    $('#undoTap').hidden = !tapping; $('#clearTap').hidden = !tapping;
    $('#undoTap').disabled = !pts.length;

    if (src === 'steps' || src === 'manual') {
      var st = fl.steps || { unit: src === 'manual' ? 'acres' : 'steps', stepM: 0.75 };
      $$('input[name=manualUnit]').forEach(function (r) { r.checked = r.value === st.unit; });
      $('#rectRows').hidden = st.unit === 'acres';
      $('#acresRow').hidden = st.unit !== 'acres';
      $('#stepRow').hidden = st.unit !== 'steps';
      var u = st.unit === 'steps' ? 'steps' : 'metres';
      $('#lenLabel').textContent = 'Length (' + u + ')';
      $('#widLabel').textContent = 'Width (' + u + ')';
      $('#manualNote').textContent = st.unit === 'acres'
        ? 'Without length and width, the planner assumes a square field to estimate the boundary. Boundary tree numbers are less accurate.'
        : st.unit === 'steps' ? 'Assumes a rectangular field. A normal adult step is about 0.75 m; change it if you have measured yours.' : 'Assumes a rectangular field.';
      show('#lenIn', st.length); show('#widIn', st.width); show('#stepM', st.stepM); show('#manualAcres', st.unit === 'acres' ? (st.acres || (src === 'manual' ? fl.acres : null)) : null);
    }
    renderMeasure();
  }
  function show(sel, v) { var el = $(sel); if (document.activeElement !== el) el.value = v === null || v === undefined ? '' : String(v); }

  function bindNum(sel, apply) {
    var el = $(sel);
    el.addEventListener('focus', function () { el.dataset.prev = el.value; setTimeout(function () { el.select(); }, 0); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
    el.addEventListener('blur', function () {
      var raw = el.value.trim().replace(/[,\s]/g, '');
      if (raw === '' || !isFinite(Number(raw))) { el.value = el.dataset.prev || ''; return; }
      var v = Math.min(Math.max(Number(raw), Number(el.dataset.min)), Number(el.dataset.max)), k = Math.pow(10, Number(el.dataset.decimals || 0));
      apply(Math.round(v * k) / k); unconfirm(); changed();
    });
  }

  function wire() {
    $('#methodWalk').addEventListener('click', startWalk);
    $('#methodTap').addEventListener('click', startTap);
    $('#noGps').addEventListener('click', function () { stopWatch(); openSteps(); });
    $('#markCorner').addEventListener('click', markCorner);
    $('#undoCorner').addEventListener('click', undoCorner);
    $('#finishWalk').addEventListener('click', finishWalk);
    $('#lockMap').addEventListener('click', toggleLock);
    $('#undoTap').addEventListener('click', function () { var fl = f(); fl.points = (fl.points || []).slice(0, -1); unconfirm(); drawShape(); changed(); });
    $('#clearTap').addEventListener('click', function () { f().points = []; unconfirm(); drawShape(); changed(); });
    $('#confirmField').addEventListener('click', confirmField);
    $$('input[name=manualUnit]').forEach(function (r) {
      r.addEventListener('change', function () { var fl = f(); fl.steps = fl.steps || { stepM: 0.75 }; fl.steps.unit = r.value; fl.source = 'steps'; unconfirm(); changed(); });
    });
    function st() { var fl = f(); fl.source = 'steps'; fl.steps = fl.steps || { unit: 'steps', stepM: 0.75 }; return fl.steps; }
    bindNum('#lenIn', function (v) { st().length = v; });
    bindNum('#widIn', function (v) { st().width = v; });
    bindNum('#stepM', function (v) { st().stepM = v; });
    bindNum('#manualAcres', function (v) { st().acres = v; });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && f().source === 'walk' && !f().walkDone) requestWake(); });
  }

  // Bring back a saved shape after reload.
  function restore() {
    var fl = f();
    if (fl.source === 'manual') { fl.source = 'steps'; fl.steps = { unit: 'acres', acres: fl.acres, stepM: 0.75 }; }
    if (fl.points && fl.points.length && (fl.source === 'tap' || fl.source === 'gps' || (fl.source === 'walk' && fl.walkDone))) {
      if (ensureMap(centroid(fl.points), 18)) drawShape();
    }
    if (fl.source === 'walk' && !fl.walkDone) { startWatch(); }
  }

  // Field outline in local metres (x east, y south) for the allocation diagram, or null.
  function shapeXY() {
    var fl = f();
    if (fl.points && fl.points.length >= 4 && (fl.source === 'tap' || fl.source === 'gps' || fl.source === 'walk')) return C.project(fl.points).map(function (p) { return [p[0], -p[1]]; });
    if (fl.source === 'steps' && fl.steps && fl.steps.unit !== 'acres' && fl.steps.length > 0 && fl.steps.width > 0) {
      var L = Math.max(fl.steps.length, fl.steps.width), W = Math.min(fl.steps.length, fl.steps.width);
      return [[0, 0], [L, 0], [L, W], [0, W]];
    }
    return null;
  }

  function reset() {
    stopWatch(); releaseWake(); capturing = false;
    if (poly) { poly.remove(); poly = null; }
    handles.forEach(function (h) { h.remove(); }); handles = [];
    if (youDot) { youDot.remove(); youDot = null; }
    $('#mapWrap').hidden = true; status(''); msg('');
  }

  window.TupandeField = {
    init: function (gs, onChange) { getState = gs; changed = onChange; wire(); restore(); },
    render: render, shapeXY: shapeXY, reset: reset, onLeave: function () { releaseWake(); },
    invalidate: function () { if (map) setTimeout(function () { map.invalidateSize(); }, 60); }
  };
})();
