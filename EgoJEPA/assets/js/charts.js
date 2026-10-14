/* EgoJEPA project page: interactive SVG charts (no dependencies).
   Data from the paper: success rates from Figure 3, data efficiency from Figure 5 (right),
   robustness from Figure 6, training time from Figures 1 and 7. The same numbers are in the
   data tables in index.html. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var COLOR = {
    accent: '#6a4f94',   // EgoJEPA (purple, as in the paper's figures)
    base: '#eb6834',     // Retargeting pipeline
    context: '#8a877f',  // other methods
    surface: '#fbfaf7',
    ink: '#111110'
  };
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  /* ---------- helpers ---------- */
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, str, cls, attrs) {
    var a = attrs || {};
    a.x = x; a.y = y;
    if (cls) a['class'] = cls;
    var t = el('text', a, parent);
    t.textContent = str;
    return t;
  }
  function linear(d0, d1, r0, r1) {
    return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
  }
  function wilson(pct, n) {
    var z = 1.959964, p = pct / 100, d = 1 + z * z / n;
    var c = (p + z * z / (2 * n)) / d;
    var h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, (c - h) * 100), Math.min(100, (c + h) * 100)];
  }
  function fmt1(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  function makeTip(plot) {
    var tip = document.createElement('div');
    tip.className = 'viz-tip';
    tip.hidden = true;
    plot.appendChild(tip);
    return {
      show: function (title, rows, x, y, desc) {
        tip.replaceChildren();
        if (title) {
          var h = document.createElement('div');
          h.className = 'tip-title';
          h.textContent = title;
          tip.appendChild(h);
        }
        rows.forEach(function (r) {
          var row = document.createElement('div');
          row.className = 'tip-row';
          var k = document.createElement('span');
          k.className = 'tip-key' + (r.shape ? ' ' + r.shape : '');
          k.style.background = r.color;
          k.style.setProperty('--kc', r.color);
          var v = document.createElement('span');
          v.className = 'tip-val';
          v.textContent = r.value;
          var l = document.createElement('span');
          l.className = 'tip-lab';
          l.textContent = r.label;
          row.appendChild(k); row.appendChild(v); row.appendChild(l);
          tip.appendChild(row);
        });
        if (desc) {
          var dd = document.createElement('div');
          dd.className = 'tip-desc';
          dd.textContent = desc;
          tip.appendChild(dd);
        }
        tip.hidden = false;
        var pw = plot.clientWidth;
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var left = x + 14;
        if (left + tw > pw) left = Math.max(0, x - tw - 14);
        var top = Math.max(0, y - th - 10);
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
      },
      hide: function () { tip.hidden = true; }
    };
  }

  function onResize(plot, fn) {
    var last = 0, queued = false;
    var run = function () {
      queued = false;
      var w = Math.round(plot.clientWidth);
      if (w && w !== last) { last = w; fn(w); }
    };
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { if (!queued) { queued = true; requestAnimationFrame(run); } }).observe(plot);
    } else {
      window.addEventListener('resize', function () { if (!queued) { queued = true; requestAnimationFrame(run); } });
    }
    run();
  }

  function localPoint(svg, evt) {
    var r = svg.getBoundingClientRect();
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  }

  /* =====================================================================
     1. Main results: dumbbell chart (out-of-domain vs in-domain)
     ===================================================================== */
  var TASK_NAMES = ['Toy grasping · Sharpa hand', 'Cup stacking · Wuji hand', 'Zipper pulling · Wuji hand',
    'Bottle cap unscrewing · Wuji hand', 'Cardboard box folding · Gripper', 'Average of five tasks'];
  // index: toy, cup, zipper, bottle cap, box, average
  var METHODS = {
    egojepa: { name: 'EgoJEPA', color: COLOR.accent, strong: true, label: true,
      desc: 'Full method: Stages 1–3.',
      id: [100, 95, 95, 90, 90, 94], ood: [80, 75, 75, 70, 70, 74] },
    retarget: { name: 'Retargeting pipeline', color: COLOR.base, label: true,
      desc: 'Same architecture, with geometrically retargeted robot actions instead of latent actions.',
      id: [85, 85, 80, 75, 75, 80], ood: [70, 70, 65, 60, 60, 65] },
    dexwild: { name: 'DexWild', color: COLOR.context,
      desc: 'Co-trains on in-the-wild human videos and robot demonstrations.',
      id: [65, 60, 45, 45, 40, 51], ood: [50, 50, 35, 35, 30, 40] },
    lapa: { name: 'LAPA', color: COLOR.context,
      desc: 'Action-free: learns latent actions from inter-frame visual changes.',
      id: [30, 25, 25, 25, 10, 23], ood: [30, 20, 15, 20, 10, 19] },
    vqvae: { name: 'EgoJEPA (VQ-VAE)', color: COLOR.context,
      desc: 'Ablation: Stage 1 JEPA replaced by VQ-VAE reconstruction of hand motion.',
      id: [75, 80, 80, 70, 65, 74], ood: [65, 70, 70, 55, 55, 63] },
    robot: { name: 'EgoJEPA (Robot-only)', color: COLOR.context,
      desc: 'Ablation: no human pre-training; trained on robot demonstrations only.',
      id: [60, 55, 50, 45, 45, 51], ood: [50, 45, 40, 30, 35, 40] }
  };
  var ROWS = [
    { m: 'egojepa' },
    { g: 'Baselines' }, { m: 'retarget' }, { m: 'dexwild' }, { m: 'lapa' },
    { g: 'Ablations' }, { m: 'vqvae' }, { m: 'robot' }
  ];

  function resultsChart(plot) {
    var fig = plot.closest('figure');
    var buttons = Array.prototype.slice.call(fig.querySelectorAll('.seg-btn'));
    var tip = makeTip(plot);
    var task = 5;
    var cur = {};   // current drawn values per method {id, ood}
    Object.keys(METHODS).forEach(function (k) { cur[k] = { id: METHODS[k].id[task], ood: METHODS[k].ood[task] }; });
    var refs = {}, geom = null, svg = null, focusRow = -1, anim = 0;

    function build(W) {
      plot.querySelectorAll('svg').forEach(function (n) { n.remove(); });
      var narrow = W < 540;
      var labelW = narrow ? 128 : 186;
      var rowH = 40, groupH = 30, top = 2, axisH = 30;
      var x0 = labelW + 14, x1 = W - 46;
      var x = linear(0, 100, x0, x1);
      var y = top, rowsGeom = [];
      ROWS.forEach(function (r) {
        if (r.g) { rowsGeom.push({ g: r.g, y0: y, y1: y + groupH }); y += groupH; }
        else { rowsGeom.push({ m: r.m, y0: y, y1: y + rowH, cy: y + rowH / 2 }); y += rowH; }
      });
      var H = y + axisH;
      svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' }, null);
      plot.insertBefore(svg, plot.firstChild);
      var bands = el('g', null, svg);
      var grid = el('g', null, svg);
      var ticks = narrow ? [0, 25, 50, 75, 100] : [0, 20, 40, 60, 80, 100];
      ticks.forEach(function (t) {
        el('line', { x1: x(t), x2: x(t), y1: top, y2: y, 'class': 'grid-line' }, grid);
        txt(grid, x(t), y + 20, t + '%', 'ax-label', { 'text-anchor': 'middle' });
      });
      var marks = el('g', null, svg);
      refs = {};
      rowsGeom.forEach(function (r) {
        if (r.g) {
          txt(marks, 0, r.y0 + 20, r.g, 'group-label');
          return;
        }
        var m = METHODS[r.m];
        var band = el('rect', { x: 0, y: r.y0 + 2, width: W, height: rowH - 4, rx: 6, 'class': 'row-band' }, bands);
        var lab = txt(marks, labelW, r.cy + 5, m.name, 'row-label' + (m.strong ? ' strong' : ''), { 'text-anchor': 'end' });
        if (narrow) lab.setAttribute('style', 'font-size:13px');
        var conn = el('line', { y1: r.cy, y2: r.cy, stroke: m.color, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.55 }, marks);
        var ring = el('circle', { cy: r.cy, r: 5.5, fill: COLOR.surface, stroke: m.color, 'stroke-width': 2 }, marks);
        var dot = el('circle', { cy: r.cy, r: 6.5, fill: m.color, stroke: COLOR.surface, 'stroke-width': 2 }, marks);
        var lo = null, hi = null;
        if (m.label) {
          lo = txt(marks, 0, r.cy + 4.5, '', 'val-label', { 'text-anchor': 'end' });
          hi = txt(marks, 0, r.cy + 4.5, '', 'val-label', { 'text-anchor': 'start' });
        }
        refs[r.m] = { band: band, conn: conn, ring: ring, dot: dot, lo: lo, hi: hi, row: r };
      });
      geom = { x: x, rows: rowsGeom.filter(function (r) { return r.m; }), W: W, H: H };
      place();
      svg.addEventListener('pointermove', function (e) {
        var p = localPoint(svg, e);
        var idx = -1;
        geom.rows.forEach(function (r, i) { if (p.y >= r.y0 && p.y < r.y1) idx = i; });
        if (idx < 0) { hover(-1); return; }
        hover(idx, p.x, p.y);
      });
      svg.addEventListener('pointerleave', function () { hover(-1); });
    }

    function place() {
      Object.keys(refs).forEach(function (k) {
        var r = refs[k], v = cur[k], x = geom.x;
        var xi = x(v.id), xo = x(v.ood);
        r.conn.setAttribute('x1', xo); r.conn.setAttribute('x2', xi);
        r.ring.setAttribute('cx', xi);
        r.dot.setAttribute('cx', xo);
        if (r.lo) {
          r.lo.setAttribute('x', xo - 11); r.lo.textContent = Math.round(v.ood) + '%';
          r.hi.setAttribute('x', xi + 11); r.hi.textContent = Math.round(v.id) + '%';
        }
      });
    }

    function hover(i, px, py) {
      Object.keys(refs).forEach(function (k) { refs[k].band.classList.remove('is-hover'); });
      if (i < 0) { tip.hide(); return; }
      var r = geom.rows[i], m = METHODS[r.m];
      refs[r.m].band.classList.add('is-hover');
      var ax = px === undefined ? geom.x(METHODS[r.m].id[task]) : px;
      var ay = py === undefined ? r.cy : py;
      tip.show(m.name + ' · ' + TASK_NAMES[task], [
        { color: m.color, shape: 'dot', value: Math.round(METHODS[r.m].ood[task]) + '%', label: 'out-of-domain' },
        { color: m.color, shape: 'ring', value: Math.round(METHODS[r.m].id[task]) + '%', label: 'in-domain' }
      ], ax, ay, m.desc);
    }

    function setTask(t) {
      if (t === task) return;
      task = t;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.task === t)); });
      var from = {}, to = {};
      Object.keys(METHODS).forEach(function (k) {
        from[k] = { id: cur[k].id, ood: cur[k].ood };
        to[k] = { id: METHODS[k].id[t], ood: METHODS[k].ood[t] };
      });
      cancelAnimationFrame(anim);
      if (reduceMotion) { cur = to; place(); return; }
      var t0 = performance.now(), dur = 420;
      var step = function (now) {
        var a = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - a, 3);
        Object.keys(METHODS).forEach(function (k) {
          cur[k] = { id: from[k].id + (to[k].id - from[k].id) * e, ood: from[k].ood + (to[k].ood - from[k].ood) * e };
        });
        place();
        if (a < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
      if (focusRow >= 0) hover(focusRow);
    }

    buttons.forEach(function (b) { b.addEventListener('click', function () { setTask(+b.dataset.task); }); });
    plot.tabIndex = 0;
    plot.addEventListener('keydown', function (e) {
      if (!geom) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusRow = Math.max(0, Math.min(geom.rows.length - 1, focusRow + (e.key === 'ArrowDown' ? 1 : -1)));
        hover(focusRow);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var order = buttons.map(function (b) { return +b.dataset.task; });
        var i = order.indexOf(task);
        setTask(order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length]);
      } else if (e.key === 'Escape') { focusRow = -1; hover(-1); }
    });
    plot.addEventListener('focus', function () { if (focusRow < 0) focusRow = 0; hover(focusRow); });
    plot.addEventListener('blur', function () { hover(-1); });
    onResize(plot, build);
  }

  /* =====================================================================
     2. Generic line chart (data efficiency, robustness, cumulative cost)
     ===================================================================== */
  function lineChart(plot, cfg) {
    var tip = makeTip(plot);
    var state = null;

    function build(W) {
      plot.querySelectorAll('svg').forEach(function (n) { n.remove(); });
      var H = cfg.height;
      var nLines = cfg.xTicks.reduce(function (n, t, i) { var l = cfg.xFmt(t, i); return Math.max(n, Array.isArray(l) ? l.length : 1); }, 1);
      var mt = cfg.title ? 30 : 10, mb = 22 + 14 * nLines + (cfg.xTitle ? 20 : 0), ml = cfg.marginLeft || 40;
      var mr = cfg.endLabels === 'name' ? (W < 420 ? 96 : 116) : 40;
      var x = linear(cfg.xDomain[0], cfg.xDomain[1], ml, W - mr);
      var y = linear(cfg.yDomain[0], cfg.yDomain[1], H - mb, mt);
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' }, null);
      plot.insertBefore(svg, plot.firstChild);
      if (cfg.title) txt(svg, 0, 14, cfg.title, 'panel-title');
      var g = el('g', null, svg);
      cfg.yTicks.forEach(function (t) {
        el('line', { x1: ml, x2: W - mr + 6, y1: y(t), y2: y(t), 'class': t === cfg.yDomain[0] ? 'base-line' : 'grid-line' }, g);
        txt(g, ml - 8, y(t) + 4, cfg.yFmt(t), 'ax-label', { 'text-anchor': 'end' });
      });
      cfg.xTicks.forEach(function (t, i) {
        var lab = cfg.xFmt(t, i);
        var lines = Array.isArray(lab) ? lab : [lab];
        lines.forEach(function (s, j) {
          txt(g, x(t), H - mb + 18 + j * 14, s, j ? 'ax-label sub' : 'ax-label', { 'text-anchor': 'middle' });
        });
      });
      if (cfg.xTitle) txt(g, (ml + W - mr) / 2, H - 6, cfg.xTitle, 'ax-title', { 'text-anchor': 'middle' });

      var bandsG = el('g', null, svg), linesG = el('g', null, svg), dotsG = el('g', null, svg), labG = el('g', null, svg);
      var cross = el('line', { y1: mt - 4, y2: H - mb, 'class': 'crosshair', visibility: 'hidden' }, svg);
      var dotRefs = [];
      cfg.series.forEach(function (s) {
        if (s.ci) {
          var up = cfg.xs.map(function (xv, i) { return [x(xv), y(wilson(s.values[i], s.n || 20)[1])]; });
          var lo = cfg.xs.map(function (xv, i) { return [x(xv), y(wilson(s.values[i], s.n || 20)[0])]; }).reverse();
          var d = 'M' + up.concat(lo).map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z';
          el('path', { d: d, fill: s.color, opacity: cfg.bandOpacity || 0.1 }, bandsG);
        }
        var pts = cfg.xs.map(function (xv, i) { return [x(xv), y(s.values[i])]; });
        el('path', { d: 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L'),
          fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, linesG);
        var dots = pts.map(function (p) {
          return el('circle', { cx: p[0], cy: p[1], r: 4, fill: s.color, stroke: COLOR.surface, 'stroke-width': 2 }, dotsG);
        });
        dotRefs.push(dots);
      });

      // direct labels at the line ends, kept apart without detaching them from their lines
      var last = cfg.xs.length - 1;
      var ends = cfg.series.map(function (s, i) { return { i: i, y: y(s.values[last]) }; }).sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;
      ends.forEach(function (e) {
        var s = cfg.series[e.i];
        var t = el('text', { x: x(cfg.xs[last]) + 10, y: e.y + 4.5, 'class': 'end-label' }, labG);
        if (cfg.endLabels === 'name') {
          var n = el('tspan', null, t); n.textContent = s.short || s.name;
          var v = el('tspan', { 'class': 'v', dx: 5 }, t); v.textContent = cfg.valueFmt(s.values[last]);
        } else {
          var v2 = el('tspan', { 'class': 'v' }, t); v2.textContent = cfg.valueFmt(s.values[last]);
        }
      });

      state = { svg: svg, x: x, y: y, cross: cross, dots: dotRefs, idx: -1, W: W };
      svg.addEventListener('pointermove', function (e) {
        var p = localPoint(svg, e);
        var best = 0, bd = Infinity;
        cfg.xs.forEach(function (xv, i) { var d = Math.abs(x(xv) - p.x); if (d < bd) { bd = d; best = i; } });
        show(best);
      });
      svg.addEventListener('pointerleave', function () { show(-1); });
    }

    function show(i) {
      if (!state) return;
      state.dots.forEach(function (dots) { dots.forEach(function (d) { d.setAttribute('r', 4); }); });
      state.idx = i;
      if (i < 0) { state.cross.setAttribute('visibility', 'hidden'); tip.hide(); return; }
      var cx = state.x(cfg.xs[i]);
      state.cross.setAttribute('x1', cx); state.cross.setAttribute('x2', cx);
      state.cross.setAttribute('visibility', 'visible');
      state.dots.forEach(function (dots) { dots[i].setAttribute('r', 5.5); });
      var rows = cfg.series.map(function (s) {
        var lab = s.name;
        if (s.ci) { var w = wilson(s.values[i], s.n || 20); lab += ' · 95% CI ' + Math.round(w[0]) + '–' + Math.round(w[1]); }
        return { color: s.color, value: cfg.valueFmt(s.values[i]), label: lab };
      });
      var topY = Math.min.apply(null, cfg.series.map(function (s) { return state.y(s.values[i]); }));
      tip.show(cfg.tipTitle(i), rows, cx, topY);
    }

    plot.addEventListener('keydown', function (e) {
      if (!state) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var n = cfg.xs.length;
        var i = state.idx < 0 ? 0 : (state.idx + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
        show(i);
      } else if (e.key === 'Escape') { show(-1); }
    });
    plot.addEventListener('focus', function () { show(state && state.idx >= 0 ? state.idx : cfg.xs.length - 1); });
    plot.addEventListener('blur', function () { show(-1); });
    onResize(plot, build);
  }

  var pct = function (v) { return Math.round(v) + '%'; };
  var Y_SUCCESS = { yDomain: [0, 100], yTicks: [0, 20, 40, 60, 80, 100], yFmt: pct, valueFmt: pct };

  function dataEfficiencyChart(plot) {
    var xs = [10, 25, 50, 100];
    lineChart(plot, Object.assign({
      height: 300, xs: xs, xDomain: [0, 100], xTicks: xs,
      xFmt: function (t) { return t + '%'; },
      xTitle: 'Robot demonstrations used for Stage 3',
      endLabels: 'name', bandOpacity: 0.07,
      tipTitle: function (i) { return xs[i] + '% of robot demonstrations'; },
      series: [
        { name: 'EgoJEPA', short: 'EgoJEPA', color: COLOR.accent, values: [35, 55, 65, 70], ci: true },
        { name: 'Retargeting pipeline', short: 'Retargeting', color: COLOR.base, values: [30, 50, 55, 60], ci: true },
        { name: 'EgoJEPA (Robot-only)', short: 'Robot-only', color: COLOR.context, values: [10, 15, 15, 30], ci: true }
      ]
    }, Y_SUCCESS));
  }

  function robustChart(plot, kind) {
    var spec = {
      noise: { title: 'Position noise', xs: [0, 2, 5, 10], unit: 'σ (mm)', ego: [70, 70, 70, 60], ret: [60, 50, 40, 30],
        tip: function (v) { return 'σ = ' + v + ' mm'; } },
      offset: { title: 'Temporal jitter', xs: [0, 3, 6, 12], unit: 'max. offset δ (frames)', ego: [70, 65, 65, 50], ret: [60, 45, 35, 25],
        tip: function (v) { return 'offset up to ±' + v + ' frames'; } },
      missing: { title: 'Annotation dropout', xs: [0, 10, 20, 40], unit: 'missing annotations p (%)', ego: [70, 70, 70, 65], ret: [60, 50, 45, 45],
        tip: function (v) { return v + '% of frames missing'; } }
    }[kind];
    lineChart(plot, Object.assign({
      height: 252, title: spec.title, xs: spec.xs,
      xDomain: [0, spec.xs[spec.xs.length - 1]], xTicks: spec.xs,
      xFmt: function (t) { return String(t); }, xTitle: spec.unit,
      endLabels: 'value',
      tipTitle: function (i) { return spec.tip(spec.xs[i]); },
      series: [
        { name: 'EgoJEPA', color: COLOR.accent, values: spec.ego, ci: true },
        { name: 'Retargeting', color: COLOR.base, values: spec.ret, ci: true }
      ]
    }, Y_SUCCESS));
  }

  /* =====================================================================
     3. Training cost: stacked bars per task + cumulative line
     ===================================================================== */
  var COST = [
    { task: 'Toy grasping', robot: 'Sharpa hand', ego: [15.8, 112.2, 45.5], ret: [52.1, 109.2, 45.5] },
    { task: 'Cup stacking', robot: 'Wuji hand', ego: [0, 0, 51.0], ret: [52.1, 109.2, 51.0] },
    { task: 'Zipper pulling', robot: 'Wuji hand', ego: [0, 0, 60.2], ret: [0, 0, 60.2] },
    { task: 'Bottle cap unscrewing', robot: 'Wuji hand', ego: [0, 0, 70.5], ret: [0, 0, 70.5] },
    { task: 'Cardboard box folding', robot: 'Gripper', ego: [0, 0, 37.5], ret: [46.7, 109.2, 37.5] }
  ];
  // One color per stage type, shared across methods, as in Figure 7 of the paper.
  var STAGE_FILL = { hap: '#7e5fb8', calib: '#4f8ccc', wm: '#d9708f', tune: '#e3a83a' };
  var STAGE_INK = { hap: '#ffffff', calib: '#111110', wm: '#111110', tune: '#111110' };
  var STAGES = {
    ego: { name: 'EgoJEPA', color: COLOR.accent, keys: ['hap', 'wm', 'tune'],
      stages: ['Human-action pre-training', 'Latent-action world modeling', 'Embodiment-specific tuning'] },
    ret: { name: 'Retargeting', color: COLOR.base, keys: ['calib', 'wm', 'tune'],
      stages: ['Human–robot calibration (CPU)', 'Human-data pre-training (world modeling)', 'Robot-data tuning'] }
  };

  function costBars(plot) {
    var tip = makeTip(plot);
    function build(W) {
      plot.querySelectorAll('svg').forEach(function (n) { n.remove(); });
      var labelW = 86, groupH = 24, barRow = 23, barH = 15, gapAfter = 12, top = 0, axisH = 26;
      var x0 = labelW + 8, x1 = W - 52;
      var x = linear(0, 220, x0, x1);
      var H = top + COST.length * (groupH + 2 * barRow + gapAfter) + axisH;
      var svg = el('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' }, null);
      plot.insertBefore(svg, plot.firstChild);
      var grid = el('g', null, svg), marks = el('g', null, svg);
      var plotBottom = H - axisH;
      [0, 50, 100, 150, 200].forEach(function (t) {
        el('line', { x1: x(t), x2: x(t), y1: top, y2: plotBottom, 'class': t === 0 ? 'base-line' : 'grid-line' }, grid);
        txt(grid, x(t), plotBottom + 18, t === 200 ? '200 h' : String(t), 'ax-label', { 'text-anchor': 'middle' });
      });
      var y = top;
      COST.forEach(function (c) {
        txt(marks, 0, y + 16, c.task + ' · ' + c.robot, 'panel-title');
        y += groupH;
        ['ego', 'ret'].forEach(function (key) {
          var S = STAGES[key], vals = c[key];
          var cy = y + barRow / 2;
          el('circle', { cx: 5, cy: cy, r: 4, fill: S.color }, marks);
          txt(marks, 14, cy + 4.5, S.name, 'row-label', { style: 'font-size:13.5px' });
          var acc = 0, total = vals[0] + vals[1] + vals[2];
          var nonZero = [0, 1, 2].filter(function (s) { return vals[s] > 0; });
          nonZero.forEach(function (s, j) {
            var a = x(acc), b = x(acc + vals[s]);
            var isLast = j === nonZero.length - 1;
            var w = Math.max(1, b - a - (isLast ? 0 : 2));
            var yTop = cy - barH / 2;
            var d;
            if (isLast) {
              var r = Math.min(4, w / 2);
              d = 'M' + a + ',' + yTop + 'H' + (a + w - r) + 'A' + r + ',' + r + ' 0 0 1 ' + (a + w) + ',' + (yTop + r) +
                'V' + (yTop + barH - r) + 'A' + r + ',' + r + ' 0 0 1 ' + (a + w - r) + ',' + (yTop + barH) + 'H' + a + 'Z';
            } else {
              d = 'M' + a + ',' + yTop + 'H' + (a + w) + 'V' + (yTop + barH) + 'H' + a + 'Z';
            }
            var seg = el('path', { d: d, fill: STAGE_FILL[S.keys[s]] }, marks);
            if (w >= 38) txt(marks, a + w / 2, cy + 4, fmt1(vals[s]), 'seg-label', { 'text-anchor': 'middle', fill: STAGE_INK[S.keys[s]] });
            var hit = el('rect', { x: a, y: cy - barRow / 2, width: Math.max(w, 6), height: barRow, 'class': 'hit' }, marks);
            hit.addEventListener('pointermove', function (e) {
              var p = localPoint(svg, e);
              tip.show(c.task + ' · ' + c.robot, [
                { color: STAGE_FILL[S.keys[s]], shape: 'sq', value: fmt1(vals[s]) + ' h', label: S.name + ' Stage ' + (s + 1) + ' · ' + S.stages[s] }
              ], p.x, p.y);
              seg.setAttribute('opacity', 0.85);
            });
            hit.addEventListener('pointerleave', function () { tip.hide(); seg.removeAttribute('opacity'); });
            acc += vals[s];
          });
          var endX = x(total) + 7;
          var tl = txt(marks, endX, cy + 4.5, fmt1(total) + ' h', 'val-label');
          if (vals[0] === 0) {
            var note = el('tspan', { 'class': 'note-label', dx: 6 }, tl);
            note.textContent = 'Stages 1–2 reused';
          }
          y += barRow;
        });
        y += gapAfter;
      });
    }
    onResize(plot, build);
  }

  function costCumulative(plot) {
    var xs = [1, 2, 3, 4, 5];
    var labels = [['Toy', 'Sharpa'], ['Cup', 'Wuji'], ['Zipper', 'Wuji'], ['Cap', 'Wuji'], ['Box', 'Gripper']];
    var ego = [173.5, 224.5, 284.7, 355.2, 392.7];
    var ret = [206.8, 419.1, 479.3, 549.8, 743.2];
    var hrs = function (v) { return fmt1(v) + ' h'; };
    lineChart(plot, {
      height: 300, title: 'Cumulative hours', xs: xs, xDomain: [0.75, 5.25], xTicks: xs,
      xFmt: function (t, i) { return labels[i]; },
      yDomain: [0, 800], yTicks: [0, 200, 400, 600, 800], yFmt: function (t) { return String(t); },
      marginLeft: 36, endLabels: 'name', valueFmt: hrs,
      tipTitle: function (i) { return 'After ' + ['toy grasping (Sharpa)', 'cup stacking (Wuji)', 'zipper pulling (Wuji)', 'bottle cap unscrewing (Wuji)', 'cardboard box folding (gripper)'][i]; },
      series: [
        { name: 'EgoJEPA', short: 'EgoJEPA', color: COLOR.accent, values: ego },
        { name: 'Retargeting', short: 'Retargeting', color: COLOR.base, values: ret }
      ]
    });
  }

  /* ---------- mount ---------- */
  function mount() {
    var map = {
      'results': resultsChart,
      'data-efficiency': dataEfficiencyChart,
      'robust-noise': function (p) { robustChart(p, 'noise'); },
      'robust-offset': function (p) { robustChart(p, 'offset'); },
      'robust-missing': function (p) { robustChart(p, 'missing'); },
      'cost-bars': costBars,
      'cost-cumulative': costCumulative
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-chart]'), function (plot) {
      var fn = map[plot.dataset.chart];
      if (fn) fn(plot);
    });
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(mount, mount);
  } else {
    mount();
  }
})();
