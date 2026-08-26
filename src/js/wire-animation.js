document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('archCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [];
  var wireCount = 0;
  var autoMode = true;
  var autoTimer = null;
  var animRunning = false;

  var C = {
    amber:   '#EF9F27',
    amberD:  '#A8763B',
    teal:    '#1D9E75',
    tealD:   '#0F6E56',
    blue:    '#378ADD',
    blueD:   '#185FA5',
    purple:  '#7F77DD',
    purpleD: '#534AB7',
    gray:    '#888780',
    muted:   '#6B665E'
  };

  var SRC = [], MODS = [], EXEC = [];
  var W, H, srcX, modX, execX;

  function layout() {
    var cw = canvas.parentElement.clientWidth - 48;
    var ch = 380;
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width  = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    W = canvas.width;
    H = canvas.height;

    srcX  = W * 0.10;
    modX  = W * 0.43;
    execX = W * 0.90;

    var pad = H * 0.07;
    var gap = H * 0.03;

    var sh = (H - pad * 2 - gap * 2) / 3;
    SRC = [
      { id: 'api',  label: 'REST APIs',      sub: 'real-time', x: srcX, y: pad,                w: W * 0.15, h: sh, col: C.amber,  colD: C.amberD  },
      { id: 'file', label: 'Flat files',     sub: 'batch',     x: srcX, y: pad + sh + gap,     w: W * 0.15, h: sh, col: C.amber,  colD: C.amberD  },
      { id: 'zday', label: '0-day payments', sub: 'same-day',  x: srcX, y: pad + sh*2 + gap*2, w: W * 0.15, h: sh, col: C.amber,  colD: C.amberD  },
    ];

    var mh = (H - pad * 2 - gap * 3) / 4;
    MODS = [
      { id: 'norm', label: 'Normalize data',        sub: 'unify all source formats',             x: modX, y: pad,                  w: W * 0.44, h: mh, col: C.amber,  colD: C.amberD,  _hl: 0 },
      { id: 'cfg',  label: 'Configuration module',  sub: 'funds · teams · SSIs — data not code', x: modX, y: pad + mh + gap,       w: W * 0.44, h: mh, col: C.purple, colD: C.purpleD, _hl: 0 },
      { id: 'en',   label: 'Enable / disable',      sub: 'per fund · per team · any granularity',x: modX, y: pad + mh*2 + gap*2,   w: W * 0.44, h: mh, col: C.purple, colD: C.purpleD, _hl: 0 },
      { id: 'stp',  label: 'STP core engine',       sub: 'validate · match SSI · route',         x: modX, y: pad + mh*3 + gap*3,   w: W * 0.44, h: mh, col: C.teal,   colD: C.tealD,   _hl: 0 },
    ];

    var eh = (H - pad * 2 - gap * 2) / 3;
    EXEC = [
      { label: 'Kyriba TMS', sub: 'treasury mgmt',  x: execX, y: pad,                w: W * 0.14, h: eh, col: C.blue, colD: C.blueD },
      { label: 'SWIFT',      sub: '99.9% of wires', x: execX, y: pad + eh + gap,     w: W * 0.14, h: eh, col: C.blue, colD: C.blueD },
      { label: 'Bank APIs',  sub: 'direct rails',   x: execX, y: pad + eh*2 + gap*2, w: W * 0.14, h: eh, col: C.blue, colD: C.blueD },
    ];
  }

  function rgba(hex, a) {
    var r = parseInt(hex.slice(1,3), 16);
    var g = parseInt(hex.slice(3,5), 16);
    var b = parseInt(hex.slice(5,7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function bcy(b) { return b.y + b.h / 2; }

  function drawBox(b, hl) {
    hl = hl || 0;
    var r = 7 * dpr;
    var x = b.x - b.w / 2;
    var y = b.y;
    ctx.beginPath();
    ctx.roundRect(x, y, b.w, b.h, r);
    ctx.fillStyle = rgba(b.col, 0.13 + hl * 0.15);
    ctx.fill();
    ctx.strokeStyle = rgba(b.colD, 0.5 + hl * 0.4);
    ctx.lineWidth = dpr * (hl ? 1.8 : 0.9);
    ctx.stroke();

    var fs = Math.max(11, Math.floor(13 * dpr / 2));
    ctx.fillStyle = b.colD;
    ctx.font = '600 ' + fs + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + b.h * 0.38);

    var ss = Math.max(9, Math.floor(10 * dpr / 2));
    ctx.fillStyle = C.muted;
    ctx.font = ss + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y + b.h * 0.70);
  }

  function drawPlatform() {
    var p  = 10 * dpr;
    var m  = MODS[0];
    var ml = MODS[MODS.length - 1];
    var x  = m.x - m.w / 2 - p;
    var y  = m.y - p;
    var w  = m.w + p * 2;
    var h  = ml.y + ml.h - m.y + p * 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * dpr);
    ctx.fillStyle = rgba(C.teal, 0.04);
    ctx.fill();
    ctx.strokeStyle = rgba(C.tealD, 0.22);
    ctx.lineWidth = dpr;
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);
    var ts = Math.max(9, Math.floor(10 * dpr / 2));
    ctx.fillStyle = rgba(C.tealD, 0.5);
    ctx.font = '500 ' + ts + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Payment automation platform', m.x, y + 5 * dpr);
  }

  function drawConnectors() {
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.lineWidth = dpr * 0.7;
    ctx.strokeStyle = rgba(C.gray, 0.22);

    SRC.forEach(function (s) {
      var m  = MODS[0];
      var sx = s.x + s.w / 2, sy = bcy(s);
      var tx = m.x - m.w / 2, ty = bcy(m);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + W * 0.07, sy, tx - W * 0.07, ty, tx, ty);
      ctx.stroke();
    });

    for (var i = 0; i < MODS.length - 1; i++) {
      var a = MODS[i], b = MODS[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + a.h);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    var lm = MODS[MODS.length - 1];
    EXEC.forEach(function (e) {
      var sx = lm.x + lm.w / 2, sy = bcy(lm);
      var tx = e.x - e.w / 2,   ty = bcy(e);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + W * 0.07, sy, tx - W * 0.07, ty, tx, ty);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  }

  function Particle(si) {
    var s = SRC[si];
    this.phase = 0;
    this.t     = 0;
    this.speed = 0.013 + Math.random() * 0.007;
    this.ei    = Math.floor(Math.random() * EXEC.length);
    this.col   = s.col;
    this.size  = dpr * (2.2 + Math.random() * 0.8);
    this.sx    = s.x + s.w / 2;
    this.sy    = bcy(s);
    this.tx    = 0;
    this.ty    = 0;
    this.setTarget();
  }

  Particle.prototype.setTarget = function () {
    var m0 = MODS[0];
    if (this.phase === 0) {
      this.tx = m0.x - m0.w / 2; this.ty = bcy(m0);
    } else if (this.phase >= 1 && this.phase <= 4) {
      var m = MODS[this.phase - 1]; this.tx = m.x; this.ty = bcy(m);
    } else if (this.phase === 5) {
      var e = EXEC[this.ei]; this.tx = e.x - e.w / 2; this.ty = bcy(e);
    }
  };

  Particle.prototype.update = function () {
    this.t += this.speed;
    if (this.t >= 1) {
      this.t  = 0;
      this.sx = this.tx;
      this.sy = this.ty;
      this.phase++;
      if (this.phase === 6) {
        wireCount++;
        var el = document.getElementById('wireCount');
        if (el) el.textContent = wireCount;
        return true;
      }
      this.setTarget();
      if (this.phase >= 1 && this.phase <= 4) MODS[this.phase - 1]._hl = 1;
    }
    return false;
  };

  Particle.prototype.draw = function () {
    var ease = function (t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; };
    var et = ease(this.t);
    var mx = (this.sx + this.tx) / 2;
    var my = (this.sy + this.ty) / 2 - H * 0.035;
    var bx = (1-et)*(1-et)*this.sx + 2*(1-et)*et*mx + et*et*this.tx;
    var by = (1-et)*(1-et)*this.sy + 2*(1-et)*et*my + et*et*this.ty;

    for (var i = 3; i >= 0; i--) {
      var tt  = Math.max(0, this.t - i * 0.05);
      var e2  = ease(tt);
      var bx2 = (1-e2)*(1-e2)*this.sx + 2*(1-e2)*e2*mx + e2*e2*this.tx;
      var by2 = (1-e2)*(1-e2)*this.sy + 2*(1-e2)*e2*my + e2*e2*this.ty;
      ctx.beginPath();
      ctx.arc(bx2, by2, this.size * (0.25 + i * 0.15), 0, Math.PI * 2);
      ctx.fillStyle = rgba(this.col, 0.1 * (4 - i));
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(bx, by, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.col;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by, this.size * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(this.col, 0.18);
    ctx.fill();
  };

  function fireSource(id) {
    var idx = SRC.findIndex(function (s) { return s.id === id; });
    if (idx >= 0) {
      for (var i = 0; i < 3; i++) {
        (function (ii) {
          setTimeout(function () { particles.push(new Particle(idx)); }, ii * 200);
        })(i);
      }
    }
  }

  function fireAll() { ['api', 'file', 'zday'].forEach(fireSource); }

  function scheduleAuto() {
    if (!autoMode) return;
    fireSource(['api', 'file', 'zday', 'api'][Math.floor(Math.random() * 4)]);
    autoTimer = setTimeout(scheduleAuto, 700 + Math.random() * 700);
  }

  function toggleAuto() {
    autoMode = !autoMode;
    var btn = document.getElementById('autoBtn');
    if (btn) {
      btn.textContent = 'Auto: ' + (autoMode ? 'ON' : 'OFF');
      if (autoMode) btn.classList.add('active'); else btn.classList.remove('active');
    }
    if (autoMode) scheduleAuto(); else clearTimeout(autoTimer);
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawConnectors();
    drawPlatform();
    MODS.forEach(function (m) { if (m._hl) m._hl = Math.max(0, m._hl - 0.025); });
    SRC.forEach(function  (b) { drawBox(b, 0); });
    MODS.forEach(function (b) { drawBox(b, b._hl); });
    EXEC.forEach(function (b) { drawBox(b, 0); });
    particles = particles.filter(function (p) {
      var done = p.update(); p.draw(); return !done;
    });
    requestAnimationFrame(loop);
  }

  // Wire up buttons
  var btnMap = { btnApi: 'api', btnFile: 'file', btnZday: 'zday' };
  Object.keys(btnMap).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function () { fireSource(btnMap[id]); });
  });
  var btnAll  = document.getElementById('btnAll');
  var btnAuto = document.getElementById('autoBtn');
  if (btnAll)  btnAll.addEventListener('click', fireAll);
  if (btnAuto) btnAuto.addEventListener('click', toggleAuto);

  window.addEventListener('resize', function () { layout(); });

  layout();
  loop();
  scheduleAuto();
});
