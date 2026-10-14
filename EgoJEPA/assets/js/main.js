/* EgoJEPA project page: video playback, hero reel, carousel, lightbox, small UI helpers. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function rateOf(v) { return parseFloat(v.dataset.rate || '1') || 1; }
  function applyRate(v) {
    var r = rateOf(v);
    v.defaultPlaybackRate = r;
    v.playbackRate = r;
  }
  function ensureSrc(v) {
    if (!v.getAttribute('src') && v.dataset.src) {
      v.src = v.dataset.src;
      v.load();
    }
  }
  function tryPlay(v) {
    if (reduceMotion.matches || v.dataset.userPaused === '1') return;
    applyRate(v);
    var p = v.play();
    if (p && p.catch) {
      p.catch(function () {
        var holder = v.closest('.card-media, .hero');
        if (holder) holder.classList.add('needs-play');
      });
    }
  }

  /* ---------- autoplay videos only while they are on screen ---------- */
  var autoVideos = Array.prototype.slice.call(document.querySelectorAll('video[data-autoplay]'));
  autoVideos.forEach(function (v) {
    v.addEventListener('loadedmetadata', function () { applyRate(v); });
    v.addEventListener('play', function () {
      var holder = v.closest('.card-media, .hero');
      if (holder) holder.classList.remove('needs-play');
    });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          ensureSrc(v);
          tryPlay(v);
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { rootMargin: '120px 0px', threshold: 0.2 });
    autoVideos.forEach(function (v) { io.observe(v); });
  } else {
    autoVideos.forEach(function (v) { ensureSrc(v); tryPlay(v); });
  }

  /* ---------- hero reel with task chip and segment progress ---------- */
  var hero = document.querySelector('[data-hero]');
  if (hero) {
    var hv = hero.querySelector('video');
    var chip = hero.querySelector('.hero-chip-text');
    var toggle = hero.querySelector('.hero-toggle');
    var bigPlay = hero.querySelector('.hero-play');
    var segs = Array.prototype.map.call(hero.querySelectorAll('.hero-seg'), function (b) {
      return { el: b, fill: b.querySelector('.fill'), start: +b.dataset.start, end: +b.dataset.end, label: b.dataset.label };
    });
    var current = -1;
    var raf = 0;

    var update = function () {
      var t = hv.currentTime || 0;
      var idx = segs.length - 1;
      for (var i = 0; i < segs.length; i++) {
        if (t >= segs[i].start && t < segs[i].end) { idx = i; break; }
      }
      for (var j = 0; j < segs.length; j++) {
        var s = segs[j];
        var p = j < idx ? 1 : j > idx ? 0 : (t - s.start) / (s.end - s.start);
        s.fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)).toFixed(4) + ')';
      }
      if (idx !== current) {
        current = idx;
        chip.textContent = segs[idx].label;
        segs.forEach(function (s, k) { s.el.setAttribute('aria-current', k === idx ? 'true' : 'false'); });
      }
    };
    var loop = function () { update(); raf = requestAnimationFrame(loop); };
    var setPlaying = function (on) {
      hero.classList.toggle('is-playing', on);
      toggle.setAttribute('aria-label', on ? 'Pause video' : 'Play video');
    };

    hv.addEventListener('play', function () { cancelAnimationFrame(raf); loop(); setPlaying(true); });
    hv.addEventListener('pause', function () { cancelAnimationFrame(raf); update(); setPlaying(false); });
    hv.addEventListener('seeked', update);
    hv.addEventListener('loadedmetadata', update);

    var userPlay = function () {
      hv.dataset.userPaused = '0';
      var p = hv.play();
      if (p && p.catch) p.catch(function () {});
    };
    toggle.addEventListener('click', function () {
      if (hv.paused) { userPlay(); } else { hv.dataset.userPaused = '1'; hv.pause(); }
    });
    bigPlay.addEventListener('click', userPlay);
    segs.forEach(function (s) {
      s.el.addEventListener('click', function () {
        hv.currentTime = s.start + 0.02;
        update();
      });
    });
    if (reduceMotion.matches) hero.classList.add('needs-play');
    update();
  }

  /* ---------- per-video speed tags ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.speed'), function (btn) {
    var v = btn.parentElement.querySelector('video');
    var rates = (btn.dataset.rates || '1,2').split(',').map(Number);
    var render = function () {
      var r = rateOf(v);
      btn.textContent = r + '×';
      btn.classList.toggle('is-fast', r !== 1);
      btn.setAttribute('aria-label', 'Playback speed ' + r + '×, click to change');
    };
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var i = rates.indexOf(rateOf(v));
      v.dataset.rate = String(rates[(i + 1) % rates.length]);
      applyRate(v);
      render();
    });
    render();
  });

  /* ---------- carousel arrows ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-carousel]'), function (root) {
    var track = root.querySelector('.track');
    var prev = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');
    var step = function () {
      var card = track.querySelector('.card');
      return card ? card.getBoundingClientRect().width + 16 : 320;
    };
    var go = function (dir) {
      track.scrollBy({ left: dir * step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    };
    var sync = function () {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 4;
    };
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () { requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  /* ---------- lightbox (videos and paper figures) ---------- */
  var dlg = document.getElementById('lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    var lv = dlg.querySelector('video');
    var li = dlg.querySelector('.lb-img');
    var cap = dlg.querySelector('.lb-caption');
    var openVideo = function (card) {
      var v = card.querySelector('video');
      var start = v.currentTime || 0;
      var rate = rateOf(v);
      cap.textContent = card.dataset.title || '';
      li.hidden = true;
      lv.hidden = false;
      dlg.classList.remove('is-image');
      lv.poster = v.poster;
      lv.src = v.dataset.src || v.currentSrc;
      lv.addEventListener('loadedmetadata', function once() {
        lv.removeEventListener('loadedmetadata', once);
        try { lv.currentTime = start; } catch (err) { /* ignore */ }
        lv.defaultPlaybackRate = rate;
        lv.playbackRate = rate;
      });
      dlg.showModal();
      var p = lv.play();
      if (p && p.catch) p.catch(function () {});
    };
    var openImage = function (btn) {
      var img = btn.querySelector('img');
      cap.textContent = btn.dataset.caption || '';
      lv.hidden = true;
      li.hidden = false;
      dlg.classList.add('is-image');
      li.src = btn.dataset.zoom;
      li.alt = img ? img.alt : '';
      dlg.showModal();
    };
    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (card) {
      var media = card.querySelector('.card-media');
      media.addEventListener('click', function (e) {
        if (e.target.closest('.speed')) return;
        openVideo(card);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-zoom]'), function (btn) {
      btn.addEventListener('click', function () { openImage(btn); });
    });
    dlg.querySelector('.lb-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () {
      lv.pause();
      lv.removeAttribute('src');
      lv.load();
      li.removeAttribute('src');
    });
  }

  /* ---------- data-table toggles ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.table-toggle'), function (btn) {
    var target = document.getElementById(btn.getAttribute('aria-controls'));
    if (!target) return;
    btn.addEventListener('click', function () {
      var show = target.hidden;
      target.hidden = !show;
      btn.setAttribute('aria-expanded', String(show));
      btn.textContent = show ? 'Hide data table' : 'Show data table';
    });
  });

  /* ---------- copy BibTeX ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () {
      var node = document.querySelector(btn.dataset.copy);
      if (!node) return;
      var done = function (msg) {
        btn.textContent = msg;
        setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(node.textContent).then(function () { done('Copied'); }, function () { selectNode(node); done('Press Ctrl+C'); });
      } else {
        selectNode(node);
        done('Press Ctrl+C');
      }
    });
  });
  function selectNode(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
})();
