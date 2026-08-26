document.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('archCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var particles = [];
  var wireCount = 0;
  var rejectCount = 0;
  var autoMode = true;
  var autoTimer = null;
  var hoveredNode = null;
  var time = 0;

  // ── Palette (warm light theme, elevated)
  var P = {
    bg:       '#F7F4EF',
    panel:    '#FFFFFF',
    border:   'rgba(0,0,0,0.07)',
    text:     '#1A1714',
    muted:    '#8A8480',
    amber:    '#D4860A', amberBg: 'rgba(212,134,10,0.10)', amberRing: 'rgba(212,134,10,0.25)',
    purple:   '#6B5FC0', purpleBg:'rgba(107,95,192,0.10)', purpleRing:'rgba(107,95,192,0.25)',
    teal:     '#1A7A5E', tealBg:  'rgba(26,122,94,0.10)',  tealRing:  'rgba(26,122,94,0.25)',
    red:      '#C0392B', redBg:   'rgba(192,57,43,0.09)',  redRing:   'rgba(192,57,43,0.25)',
    orange:   '#C4640A', orangeBg:'rgba(196,100,10,0.10)', orangeRing:'rgba(196,100,10,0.25)',
    blue:     '#1A5FAA', blueBg:  'rgba(26,95,170,0.10)',  blueRing:  'rgba(26,95,170,0.25)',
    // particle colours
    pAmber:  '#F59E0B',
    pRed:    '#EF4444',
    pBlue:   '#3B82F6',
    pGreen:  '#10B981',
  };

  function rgba(hex, a) {
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }

  var W, H;
  var SRC=[], MODS=[], REJECT_BOX, REVIEW_BOX, EXEC_BOX;

  // ── node helpers
  function bl(b){return b.x - b.w/2;}
  function br(b){return b.x + b.w/2;}
  function bt(b){return b.y;}
  function bb(b){return b.y + b.h;}
  function bcy(b){return b.y + b.h/2;}

  function inside(b, mx, my) {
    return mx >= bl(b) && mx <= br(b) && my >= bt(b) && my <= bb(b);
  }

  function layout() {
    var cw = canvas.parentElement.clientWidth - 8;
    var ch = 500;
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width  = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    W = canvas.width; H = canvas.height;

    var gap  = H * 0.020;
    var padT = H * 0.055;
    var padB = H * 0.055;
    var availH = H - padT - padB;

    // Column x-positions
    var c1 = W * 0.082;  // sources
    var c2 = W * 0.310;  // platform modules (centre of module)
    var c3 = W * 0.680;  // reject + review
    var c4 = W * 0.895;  // execution

    // Sources — 3 equal boxes
    var sw = W * 0.115, sh = (availH - gap*2) / 3;
    var srcTop = padT + (availH - sh*3 - gap*2)/2; // vertically centre in middle 70%
    srcTop = padT + availH*0.17;
    SRC = [
      {id:'api', label:'REST API',    sub:'real-time',  x:c1, y:srcTop,            w:sw, h:sh, col:P.amber,  bg:P.amberBg,  ring:P.amberRing,  pc:P.pAmber},
      {id:'file',label:'Flat file',   sub:'batch',      x:c1, y:srcTop+sh+gap,     w:sw, h:sh, col:P.amber,  bg:P.amberBg,  ring:P.amberRing,  pc:P.pAmber},
      {id:'zday',label:'0-day',       sub:'same-day',   x:c1, y:srcTop+sh*2+gap*2, w:sw, h:sh, col:P.amber,  bg:P.amberBg,  ring:P.amberRing,  pc:P.pAmber},
    ];

    // Platform modules — 4 equal boxes filling full height
    var mw = W * 0.345, mh = (availH - gap*3) / 4;
    MODS = [
      {id:'norm',label:'Normalize',          sub:'unify all source formats',             x:c2, y:padT,              w:mw, h:mh, col:P.amber,  bg:P.amberBg,  ring:P.amberRing,  _hl:0, _pulse:0},
      {id:'cfg', label:'Configuration',      sub:'funds · teams · SSIs — data not code', x:c2, y:padT+mh+gap,       w:mw, h:mh, col:P.purple, bg:P.purpleBg, ring:P.purpleRing, _hl:0, _pulse:0},
      {id:'en',  label:'Enable / Disable',   sub:'some pass · some reject',              x:c2, y:padT+mh*2+gap*2,  w:mw, h:mh, col:P.red,    bg:P.redBg,    ring:P.redRing,    _hl:0, _pulse:0},
      {id:'stp', label:'STP Core Engine',    sub:'validate · match SSI · route',         x:c2, y:padT+mh*3+gap*3,  w:mw, h:mh, col:P.teal,   bg:P.tealBg,   ring:P.tealRing,   _hl:0, _pulse:0},
    ];

    // Right column — Reject Queue + Human Review, together filling full height
    var rw = W * 0.220;
    var rqH = availH * 0.30, rvH = availH * 0.42;
    var rcGap = availH - rqH - rvH;
    REJECT_BOX = {id:'rq', label:'Reject Queue',  sub:'requires investigation', x:c3, y:padT,            w:rw, h:rqH, col:P.red,    bg:P.redBg,    ring:P.redRing,    _hl:0, _pulse:0};
    REVIEW_BOX = {id:'rv', label:'Human Review',  sub:'approves or rejects',    x:c3, y:padT+rqH+rcGap, w:rw, h:rvH, col:P.orange, bg:P.orangeBg, ring:P.orangeRing, _hl:0, _pulse:0};

    // Execution — full height, far right
    var ew = W * 0.130;
    EXEC_BOX = {id:'ex', label:'Execution', lines:['Kyriba TMS','SWIFT','Bank APIs'],
      x:c4, y:padT, w:ew, h:availH, col:P.blue, bg:P.blueBg, ring:P.blueRing, _hl:0, _pulse:0};
  }

  // ─── DRAW HELPERS ───────────────────────────────────────

  function shadow(spread, col) {
    ctx.shadowBlur   = spread;
    ctx.shadowColor  = col;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  function noShadow() { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

  function drawNode(b) {
    var hl = b._hl || 0;
    var r  = 10 * dpr;
    var x  = bl(b), y = bt(b);
    var hovered = (hoveredNode && hoveredNode.id === b.id);

    // Glow on highlight
    if (hl > 0.05) shadow(18 * dpr * hl, rgba(b.col, 0.35 * hl));

    // Fill
    ctx.beginPath(); ctx.roundRect(x, y, b.w, b.h, r);
    ctx.fillStyle = b.bg;
    ctx.fill();

    // Border — thicker & coloured when active
    ctx.strokeStyle = hl > 0.1 ? rgba(b.col, 0.6 + hl*0.3) : (hovered ? rgba(b.col, 0.5) : rgba(b.col, 0.22));
    ctx.lineWidth   = dpr * (hl > 0.1 ? 1.5 : 1);
    ctx.stroke();
    noShadow();

    // Pulse ring
    if (b._pulse > 0) {
      var pr = b._pulse;
      ctx.beginPath();
      ctx.roundRect(x - pr*8*dpr, y - pr*8*dpr, b.w + pr*16*dpr, b.h + pr*16*dpr, r + pr*8*dpr);
      ctx.strokeStyle = rgba(b.col, pr * 0.4);
      ctx.lineWidth   = dpr * 1.5;
      ctx.stroke();
    }

    // Label
    var fs = Math.max(11, Math.floor(13.5 * dpr / 2));
    ctx.fillStyle = b.col;
    ctx.font = '600 ' + fs + 'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + b.h * 0.38);

    // Sub
    var ss = Math.max(8, Math.floor(10 * dpr / 2));
    ctx.fillStyle = P.muted;
    ctx.font = ss + 'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y + b.h * 0.67);
  }

  function drawReviewNode() {
    var b = REVIEW_BOX, hl = b._hl || 0;
    var r = 10 * dpr, x = bl(b), y = bt(b);
    var hovered = hoveredNode && hoveredNode.id === b.id;

    if (hl > 0.05) shadow(18*dpr*hl, rgba(b.col, 0.35*hl));
    ctx.beginPath(); ctx.roundRect(x, y, b.w, b.h, r);
    ctx.fillStyle = b.bg; ctx.fill();
    ctx.strokeStyle = hl > 0.1 ? rgba(b.col, 0.6+hl*0.3) : (hovered ? rgba(b.col,0.5) : rgba(b.col,0.22));
    ctx.lineWidth = dpr*(hl>0.1?1.5:1); ctx.stroke();
    noShadow();

    if (b._pulse > 0) {
      ctx.beginPath(); ctx.roundRect(bl(b)-b._pulse*8*dpr, bt(b)-b._pulse*8*dpr, b.w+b._pulse*16*dpr, b.h+b._pulse*16*dpr, r+b._pulse*8*dpr);
      ctx.strokeStyle = rgba(b.col, b._pulse*0.4); ctx.lineWidth = dpr*1.5; ctx.stroke();
    }

    // Person icon (clean minimal)
    var cx = b.x, cy = b.y + b.h * 0.28;
    var cr = Math.min(b.h * 0.13, b.w * 0.13);
    // head
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2);
    ctx.fillStyle = rgba(b.col, 0.7); ctx.fill();
    // shoulders
    ctx.beginPath();
    ctx.arc(cx, cy + cr * 2.1, cr * 1.55, Math.PI, 0);
    ctx.fillStyle = rgba(b.col, 0.35); ctx.fill();

    // label
    var fs = Math.max(11, Math.floor(13.5*dpr/2));
    ctx.fillStyle = b.col;
    ctx.font = '600 '+fs+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + b.h * 0.74);
    var ss = Math.max(8, Math.floor(10*dpr/2));
    ctx.fillStyle = P.muted;
    ctx.font = ss+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.fillText(b.sub, b.x, b.y + b.h * 0.88);
  }

  function drawExecNode() {
    var b = EXEC_BOX, hl = b._hl||0;
    var r = 10*dpr, x = bl(b), y = bt(b);
    var hovered = hoveredNode && hoveredNode.id === b.id;

    if (hl > 0.05) shadow(18*dpr*hl, rgba(b.col, 0.35*hl));
    ctx.beginPath(); ctx.roundRect(x, y, b.w, b.h, r);
    ctx.fillStyle = b.bg; ctx.fill();
    ctx.strokeStyle = hl > 0.1 ? rgba(b.col,0.6+hl*0.3) : (hovered ? rgba(b.col,0.5) : rgba(b.col,0.22));
    ctx.lineWidth = dpr*(hl>0.1?1.5:1); ctx.stroke();
    noShadow();

    if (b._pulse > 0) {
      ctx.beginPath(); ctx.roundRect(bl(b)-b._pulse*8*dpr, bt(b)-b._pulse*8*dpr, b.w+b._pulse*16*dpr, b.h+b._pulse*16*dpr, r+b._pulse*8*dpr);
      ctx.strokeStyle = rgba(b.col, b._pulse*0.4); ctx.lineWidth = dpr*1.5; ctx.stroke();
    }

    // Title
    var fs = Math.max(11, Math.floor(13.5*dpr/2));
    ctx.fillStyle = b.col;
    ctx.font = '700 '+fs+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + b.h*0.10);

    // Hairline divider
    ctx.beginPath();
    ctx.moveTo(bl(b)+12*dpr, b.y+b.h*0.19);
    ctx.lineTo(br(b)-12*dpr, b.y+b.h*0.19);
    ctx.strokeStyle = rgba(b.col, 0.15); ctx.lineWidth = dpr*0.8; ctx.stroke();

    // Sub-items
    var ls = b.lines;
    var ss = Math.max(9, Math.floor(11.5*dpr/2));
    var slotH = (b.h * 0.81) / ls.length;
    ls.forEach(function(lbl, i) {
      var ly = b.y + b.h*0.19 + slotH*(i+0.5);
      ctx.beginPath(); ctx.arc(bl(b)+16*dpr, ly, 3.5*dpr, 0, Math.PI*2);
      ctx.fillStyle = rgba(b.col, 0.55); ctx.fill();
      ctx.fillStyle = b.col;
      ctx.font = '500 '+ss+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(lbl, bl(b)+28*dpr, ly);
      if (i < ls.length-1) {
        ctx.beginPath();
        ctx.moveTo(bl(b)+12*dpr, b.y+b.h*0.19+slotH*(i+1));
        ctx.lineTo(br(b)-12*dpr, b.y+b.h*0.19+slotH*(i+1));
        ctx.strokeStyle = rgba(b.col,0.09); ctx.lineWidth = dpr*0.6; ctx.stroke();
      }
    });
  }

  function drawPlatformBox() {
    var p = 14*dpr, m=MODS[0], ml=MODS[MODS.length-1];
    var x=bl(m)-p, y=bt(m)-p, w=m.w+p*2, h=bb(ml)-bt(m)+p*2;
    ctx.beginPath(); ctx.roundRect(x,y,w,h,16*dpr);
    ctx.fillStyle = 'rgba(26,122,94,0.025)'; ctx.fill();
    ctx.strokeStyle = rgba(P.teal, 0.15); ctx.lineWidth = dpr;
    ctx.setLineDash([6*dpr,5*dpr]); ctx.stroke(); ctx.setLineDash([]);
    var ts = Math.max(8, Math.floor(9*dpr/2));
    ctx.fillStyle = rgba(P.teal, 0.5);
    ctx.font = '500 '+ts+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('Payment automation platform', m.x, y+5*dpr);
  }

  // ─── CONNECTOR PATHS ────────────────────────────────────

  // Store path data for particle animation
  var PATHS = {};

  function buildPaths() {
    var en=MODS[2], stp=MODS[3], rv=REVIEW_BOX, rq=REJECT_BOX, ex=EXEC_BOX;

    // Direct STP → Execution (most wires)
    PATHS.direct = {
      sx: br(stp), sy: bcy(stp),
      cx1: br(stp)+W*0.06, cy1: bcy(stp),
      cx2: bl(ex)-W*0.03, cy2: bcy(ex),
      tx: bl(ex), ty: bcy(ex)
    };

    // STP → Review (exceptions)
    PATHS.review = {
      sx: br(stp), sy: bcy(stp)+H*0.03,
      cx1: br(stp)+W*0.04, cy1: bcy(stp)+H*0.05,
      cx2: bl(rv)-W*0.03, cy2: bcy(rv),
      tx: bl(rv), ty: bcy(rv)
    };

    // Enable/Disable → Reject Queue
    PATHS.reject_en = {
      sx: br(en), sy: bcy(en),
      cx1: br(en)+W*0.07, cy1: bcy(en),
      cx2: bl(rq)-W*0.02, cy2: bcy(rq),
      tx: bl(rq), ty: bcy(rq)
    };

    // Review → Reject Queue (up)
    PATHS.reject_rv = {
      sx: rv.x, sy: bt(rv),
      cx1: rv.x, cy1: bt(rv)-H*0.04,
      cx2: rq.x, cy2: bb(rq)+H*0.04,
      tx: rq.x, ty: bb(rq)
    };

    // Review → Execution (approved)
    PATHS.approved = {
      sx: br(rv), sy: bcy(rv),
      cx1: br(rv)+W*0.03, cy1: bcy(rv),
      cx2: bl(ex)-W*0.02, cy2: bcy(ex)+ex.h*0.35,
      tx: bl(ex), ty: bcy(ex)+ex.h*0.35
    };
  }

  function pathPoint(p, t) {
    var e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out
    var x = (1-e)*(1-e)*(1-e)*p.sx + 3*(1-e)*(1-e)*e*p.cx1 + 3*(1-e)*e*e*p.cx2 + e*e*e*p.tx;
    var y = (1-e)*(1-e)*(1-e)*p.sy + 3*(1-e)*(1-e)*e*p.cy1 + 3*(1-e)*e*e*p.cy2 + e*e*e*p.ty;
    return {x:x, y:y};
  }

  function drawConnectorLine(p, col, width, dashed) {
    ctx.beginPath();
    ctx.moveTo(p.sx, p.sy);
    ctx.bezierCurveTo(p.cx1, p.cy1, p.cx2, p.cy2, p.tx, p.ty);
    ctx.strokeStyle = rgba(col, 0.20);
    ctx.lineWidth   = dpr * (width||0.8);
    if (dashed) ctx.setLineDash([5*dpr,4*dpr]); else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function arrowHead(p, col) {
    var t1 = pathPoint(p, 0.97), t2 = pathPoint(p, 1.0);
    var ang = Math.atan2(t2.y-t1.y, t2.x-t1.x);
    var sz  = 5*dpr;
    ctx.beginPath();
    ctx.moveTo(t2.x, t2.y);
    ctx.lineTo(t2.x - sz*Math.cos(ang-0.4), t2.y - sz*Math.sin(ang-0.4));
    ctx.lineTo(t2.x - sz*Math.cos(ang+0.4), t2.y - sz*Math.sin(ang+0.4));
    ctx.closePath();
    ctx.fillStyle = rgba(col, 0.45); ctx.fill();
  }

  function edgeLabel(text, x, y, col) {
    var fs = Math.max(7, Math.floor(8.5*dpr/2));
    ctx.font = '500 '+fs+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    ctx.fillStyle = rgba(col, 0.75);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // tiny pill bg
    var tw = ctx.measureText(text).width + 8*dpr;
    ctx.fillStyle = rgba(col, 0.08);
    ctx.beginPath(); ctx.roundRect(x-tw/2, y-6*dpr, tw, 12*dpr, 4*dpr); ctx.fill();
    ctx.fillStyle = rgba(col, 0.80);
    ctx.fillText(text, x, y);
  }

  function drawConnectors() {
    var en=MODS[2], stp=MODS[3], rv=REVIEW_BOX, rq=REJECT_BOX;

    // Sources → Normalize (fan)
    SRC.forEach(function(s) {
      var m=MODS[0];
      ctx.beginPath();
      ctx.moveTo(br(s), bcy(s));
      ctx.bezierCurveTo(br(s)+W*0.04, bcy(s), bl(m)-W*0.02, bcy(m), bl(m), bcy(m));
      ctx.strokeStyle = rgba(P.amber, 0.18); ctx.lineWidth = dpr*0.8;
      ctx.setLineDash([5*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    });

    // Module chain
    for (var i=0; i<MODS.length-1; i++) {
      var a=MODS[i], b=MODS[i+1];
      ctx.beginPath(); ctx.moveTo(a.x, bb(a)); ctx.lineTo(b.x, bt(b));
      ctx.strokeStyle = rgba(P.muted, 0.18); ctx.lineWidth = dpr*0.8;
      ctx.setLineDash([5*dpr,4*dpr]); ctx.stroke(); ctx.setLineDash([]);
    }

    // en → reject queue
    drawConnectorLine(PATHS.reject_en, P.red, 0.8, true);
    arrowHead(PATHS.reject_en, P.red);
    edgeLabel('rejected', br(en)+W*0.038, bcy(en)-H*0.028, P.red);

    // STP → Execution (direct, thicker)
    drawConnectorLine(PATHS.direct, P.blue, 1.6, false);
    arrowHead(PATHS.direct, P.blue);
    edgeLabel('direct STP', br(stp)+W*0.045, bcy(stp)-H*0.024, P.blue);

    // STP → Review
    drawConnectorLine(PATHS.review, P.orange, 0.8, true);
    arrowHead(PATHS.review, P.orange);
    edgeLabel('exceptions', br(stp)+W*0.04, bcy(stp)+H*0.055, P.orange);

    // rv → reject queue
    drawConnectorLine(PATHS.reject_rv, P.red, 0.8, true);
    arrowHead(PATHS.reject_rv, P.red);
    edgeLabel('rejected', rv.x - rv.w*0.05, bt(rv)-H*0.028, P.red);

    // rv → execution (approved)
    drawConnectorLine(PATHS.approved, P.teal, 0.8, true);
    arrowHead(PATHS.approved, P.teal);
    edgeLabel('approved', br(rv)+W*0.025, bcy(rv)-H*0.022, P.teal);
  }

  // ─── TOOLTIP ────────────────────────────────────────────

  var TOOLTIPS = {
    norm: 'All incoming formats — REST JSON, flat CSV/TXT, real-time messages — are normalised into one wire instruction shape.',
    cfg:  'Funds, teams, and SSIs are registered as configuration. Adding a new fund requires no code change.',
    en:   'Funds can be enabled or disabled per fund, per team, or at any granularity. Disabled funds reject here.',
    stp:  'The core validates the instruction, matches the SSI, and routes to execution — or flags for human review.',
    rq:   'Rejected wires land here for investigation. Separate queue from live processing. Nothing lost.',
    rv:   'A human reviewer approves or rejects flagged wires. Approved wires continue to execution.',
    ex:   'Kyriba TMS, SWIFT, and Bank APIs form the execution layer. 99.9% of wires exit via SWIFT.',
    api:  'Real-time REST API sources feed wire instructions directly.',
    file: 'Flat file batches are ingested and normalised on arrival.',
    zday: 'Same-day payment sources feed the platform in real time.',
  };

  function drawTooltip(b) {
    if (!TOOLTIPS[b.id]) return;
    var text = TOOLTIPS[b.id];
    var maxW = Math.min(W*0.30, 240*dpr);
    var fs   = Math.max(8, Math.floor(10*dpr/2));
    ctx.font  = fs+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';

    // Word-wrap
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function(w) {
      var test = cur ? cur+' '+w : w;
      if (ctx.measureText(test).width > maxW - 16*dpr) { lines.push(cur); cur = w; }
      else cur = test;
    });
    if (cur) lines.push(cur);

    var lh = fs * 1.5, pad = 10*dpr;
    var tw = maxW, th = lines.length * lh + pad * 2;
    var tx = b.x - tw/2, ty = bb(b) + 8*dpr;
    // keep on screen
    if (tx < 4*dpr) tx = 4*dpr;
    if (tx + tw > W - 4*dpr) tx = W - tw - 4*dpr;
    if (ty + th > H - 4*dpr) ty = bt(b) - th - 8*dpr;

    shadow(12*dpr, 'rgba(0,0,0,0.12)');
    ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 7*dpr);
    ctx.fillStyle = '#FFFDF9'; ctx.fill();
    ctx.strokeStyle = rgba(b.col, 0.30); ctx.lineWidth = dpr; ctx.stroke();
    noShadow();

    ctx.fillStyle = P.text;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach(function(l, i) {
      ctx.fillText(l, tx+pad, ty+pad+i*lh);
    });
  }

  // ─── PARTICLES ──────────────────────────────────────────

  function Particle(si) {
    var s = SRC[si];
    this.phase  = 0; this.t = 0;
    this.speed  = 0.016 + Math.random()*0.008;
    this.col    = s.pc; this.size = dpr*(1.8+Math.random()*0.8);
    this.sx = br(s); this.sy = bcy(s);
    this.tx = 0;     this.ty = 0;
    this.path   = null;  // which named path are we on
    this.modIdx = 0;     // current module index (0-3)
    var r = Math.random();
    this.fate = r<0.15 ? 'reject_en' : r<0.26 ? 'reject_rv' : 'direct';
    this.history = [{x:this.sx, y:this.sy}];
    this.setTarget();
  }

  Particle.prototype.setTarget = function() {
    // Phase 0-3: move through src→norm entry, then module centres
    var m0 = MODS[0];
    if (this.phase === 0) { this.tx=bl(m0); this.ty=bcy(m0); this.path=null; }
    else if (this.phase >= 1 && this.phase <= 4) {
      var m=MODS[this.phase-1]; this.tx=m.x; this.ty=bcy(m); this.path=null;
    }
    // Phase 5: STP done, choose route
    else if (this.phase === 5) {
      if (this.fate==='direct') {
        var dp=PATHS.direct; this.tx=dp.tx; this.ty=dp.ty; this.path='direct';
      } else {
        var rp=PATHS.review; this.tx=rp.tx; this.ty=rp.ty; this.path='review';
      }
    }
    // Phase 6: inside review node
    else if (this.phase === 6) { this.tx=REVIEW_BOX.x; this.ty=bcy(REVIEW_BOX); this.path=null; }
    // Phase 7: review → exec (approved) OR review → reject
    else if (this.phase === 7) {
      if (this.fate==='reject_rv') {
        var rrp=PATHS.reject_rv; this.tx=rrp.tx; this.ty=rrp.ty; this.path='reject_rv';
      } else {
        var ap=PATHS.approved; this.tx=ap.tx; this.ty=ap.ty; this.path='approved';
      }
    }
    // Phase 8 (reject_en): en→reject queue
    else if (this.phase === 8) {
      var ep=PATHS.reject_en; this.tx=ep.tx; this.ty=ep.ty; this.path='reject_en';
    }
  };

  Particle.prototype.currentPos = function() {
    if (this.path && PATHS[this.path]) {
      return pathPoint(PATHS[this.path], this.t);
    }
    var ease=function(t){return t<0.5?2*t*t:-1+(4-2*t)*t;};
    var e=ease(this.t);
    return {x:(1-e)*this.sx+e*this.tx, y:(1-e)*this.sy+e*this.ty};
  };

  Particle.prototype.update = function() {
    this.t += this.speed;
    var pos = this.currentPos();
    this.history.push({x:pos.x, y:pos.y});
    if (this.history.length > 10) this.history.shift();

    if (this.t >= 1) {
      this.t=0; this.sx=this.tx; this.sy=this.ty; this.path=null;
      this.phase++;

      // Rejection at enable/disable
      if (this.phase===4 && this.fate==='reject_en') {
        this.col=P.pRed; this.phase=8; MODS[2]._hl=1; MODS[2]._pulse=1;
        rejectCount++; var re=document.getElementById('rejectCount'); if(re)re.textContent=rejectCount;
      }
      // Direct STP done
      else if (this.phase===6 && this.fate==='direct') {
        EXEC_BOX._hl=1; EXEC_BOX._pulse=1;
        wireCount++; var we=document.getElementById('wireCount'); if(we)we.textContent=wireCount;
        return true;
      }
      // Reject at review
      else if (this.phase===8 && this.fate==='reject_rv') {
        this.col=P.pRed; this.phase=8; REVIEW_BOX._hl=1;
        // reroute — go to reject queue via reject_rv path
        this.phase=7; // will be incremented below to allow path set
        this.fate='reject_rv';
        // Actually handle directly:
        this.phase=99; // mark done after reject
        rejectCount++; var rr=document.getElementById('rejectCount'); if(rr)rr.textContent=rejectCount;
        REJECT_BOX._hl=1; REJECT_BOX._pulse=1;
        return true;
      }
      // Approved from review → exec done
      else if (this.phase===8 && this.fate!=='reject_rv' && this.fate!=='reject_en') {
        EXEC_BOX._hl=1; EXEC_BOX._pulse=1;
        wireCount++; var wa=document.getElementById('wireCount'); if(wa)wa.textContent=wireCount;
        return true;
      }
      // Reject queue arrived
      else if (this.phase===9 || this.phase===99) {
        REJECT_BOX._hl=1; REJECT_BOX._pulse=1;
        return true;
      }
      else if (this.phase > 9) { return true; }

      if (this.phase>=1&&this.phase<=4) { MODS[this.phase-1]._hl=1; MODS[this.phase-1]._pulse=1; }
      if (this.phase===6) { REVIEW_BOX._hl=1; REVIEW_BOX._pulse=1; }
      this.setTarget();
    }
    return false;
  };

  Particle.prototype.draw = function() {
    var pos = this.currentPos();

    // Trail
    for (var i=0; i<this.history.length; i++) {
      var h=this.history[i], frac=i/this.history.length;
      ctx.beginPath(); ctx.arc(h.x, h.y, this.size*(0.15+frac*0.35), 0, Math.PI*2);
      ctx.fillStyle = rgba(this.col, frac*0.18); ctx.fill();
    }

    // Outer glow
    var grad = ctx.createRadialGradient(pos.x,pos.y,0, pos.x,pos.y,this.size*3.5);
    grad.addColorStop(0, rgba(this.col,0.35));
    grad.addColorStop(1, rgba(this.col,0));
    ctx.beginPath(); ctx.arc(pos.x,pos.y,this.size*3.5,0,Math.PI*2);
    ctx.fillStyle=grad; ctx.fill();

    // Core dot
    ctx.beginPath(); ctx.arc(pos.x,pos.y,this.size,0,Math.PI*2);
    ctx.fillStyle=this.col; ctx.fill();

    // Bright centre
    ctx.beginPath(); ctx.arc(pos.x,pos.y,this.size*0.45,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fill();
  };

  // ─── COUNTER ────────────────────────────────────────────

  function drawLiveCounter() {
    var pad=10*dpr, x=W-pad, y=pad;
    var fs=Math.max(8,Math.floor(9*dpr/2));
    ctx.font='500 '+fs+'px -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif';
    var done = '✓ '+wireCount+' executed';
    var rej  = '✗ '+rejectCount+' rejected';
    var dw=ctx.measureText(done).width+12*dpr, rw=ctx.measureText(rej).width+12*dpr;
    var bh=14*dpr, gap=6*dpr;

    ctx.beginPath(); ctx.roundRect(x-dw, y, dw, bh, 4*dpr);
    ctx.fillStyle=rgba(P.teal,0.10); ctx.fill();
    ctx.fillStyle=P.teal; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(done, x-dw/2, y+bh/2);

    ctx.beginPath(); ctx.roundRect(x-dw-gap-rw, y, rw, bh, 4*dpr);
    ctx.fillStyle=rgba(P.red,0.10); ctx.fill();
    ctx.fillStyle=P.red;
    ctx.fillText(rej, x-dw-gap-rw/2, y+bh/2);
  }

  // ─── MAIN LOOP ──────────────────────────────────────────

  function tick() {
    time++;
    ctx.clearRect(0,0,W,H);

    // Decay all _hl and _pulse
    var allNodes = MODS.concat([REJECT_BOX,REVIEW_BOX,EXEC_BOX]);
    allNodes.forEach(function(b){
      if(b._hl)    b._hl    = Math.max(0, b._hl-0.030);
      if(b._pulse) b._pulse = Math.max(0, b._pulse-0.040);
    });

    drawConnectors();
    drawPlatformBox();
    SRC.forEach(drawNode);
    MODS.forEach(drawNode);
    drawNode(REJECT_BOX);
    drawReviewNode();
    drawExecNode();
    drawLiveCounter();

    particles = particles.filter(function(p){ var done=p.update(); p.draw(); return !done; });

    if (hoveredNode) drawTooltip(hoveredNode);

    requestAnimationFrame(tick);
  }

  // ─── CONTROLS ───────────────────────────────────────────

  function fireSource(id) {
    var idx=SRC.findIndex(function(s){return s.id===id;});
    if(idx<0)return;
    for(var i=0;i<4;i++)(function(ii){
      setTimeout(function(){particles.push(new Particle(idx));},ii*180);
    })(i);
  }
  function fireAll(){ ['api','file','zday'].forEach(fireSource); }

  function scheduleAuto(){
    if(!autoMode)return;
    fireSource(['api','file','zday','api','file','api','zday'][Math.floor(Math.random()*7)]);
    autoTimer=setTimeout(scheduleAuto,900+Math.random()*700);
  }
  function toggleAuto(){
    autoMode=!autoMode;
    var btn=document.getElementById('autoBtn');
    if(btn){btn.textContent='Auto: '+(autoMode?'ON':'OFF');
      if(autoMode)btn.classList.add('active');else btn.classList.remove('active');}
    if(autoMode)scheduleAuto();else clearTimeout(autoTimer);
  }

  // Button wiring
  var bm={btnApi:'api',btnFile:'file',btnZday:'zday'};
  Object.keys(bm).forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener('click',function(){fireSource(bm[id]);});
  });
  var bAll=document.getElementById('btnAll'), bAuto=document.getElementById('autoBtn');
  if(bAll) bAll.addEventListener('click',fireAll);
  if(bAuto)bAuto.addEventListener('click',toggleAuto);

  // Hover detection
  var rect = canvas.getBoundingClientRect();
  function onMove(e) {
    rect = canvas.getBoundingClientRect();
    var mx=(e.clientX-rect.left)*dpr, my=(e.clientY-rect.top)*dpr;
    var all=SRC.concat(MODS).concat([REJECT_BOX,REVIEW_BOX,EXEC_BOX]);
    hoveredNode=null;
    for(var i=0;i<all.length;i++){ if(inside(all[i],mx,my)){hoveredNode=all[i];break;} }
    canvas.style.cursor = hoveredNode?'help':'default';
  }
  canvas.addEventListener('mousemove',onMove);
  canvas.addEventListener('mouseleave',function(){hoveredNode=null;canvas.style.cursor='default';});

  window.addEventListener('resize',function(){layout();buildPaths();});

  layout();
  buildPaths();
  tick();
  scheduleAuto();
});
