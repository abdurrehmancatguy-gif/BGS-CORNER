/* ==========================================================================
   BGS CORNER — scroll-driven hero sequence + site interactions
   ========================================================================== */
(function () {
  'use strict';

  var FRAME_COUNT = 177;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Pick the image set: small viewports (and low-DPR small screens) get the
     900px set, everything else the 1600px set. */
  var useMobileSet = window.matchMedia('(max-width: 820px)').matches;
  var SET = useMobileSet ? 'mobile' : 'desktop';

  function framePath(i) {
    return 'assets/frames/' + SET + '/f_' + String(i).padStart(4, '0') + '.jpg';
  }

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* ======================================================================
     1. IMAGE PIPELINE
     ====================================================================== */
  var images = new Array(FRAME_COUNT + 1);
  var loaded = new Array(FRAME_COUNT + 1).fill(false);

  function loadFrame(i) {
    return new Promise(function (resolve) {
      if (loaded[i]) return resolve();
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { images[i] = img; loaded[i] = true; resolve(); };
      img.onerror = function () { resolve(); };
      img.src = framePath(i);
    });
  }

  /* Run a list of frame indices with a concurrency cap. */
  function loadQueue(list, concurrency, onProgress) {
    var idx = 0, done = 0;
    return new Promise(function (resolve) {
      if (!list.length) return resolve();
      function next() {
        if (idx >= list.length) return;
        var i = list[idx++];
        loadFrame(i).then(function () {
          done++;
          if (onProgress) onProgress(done / list.length);
          if (done === list.length) resolve();
          next();
        });
      }
      for (var c = 0; c < Math.min(concurrency, list.length); c++) next();
    });
  }

  /* Coarse pass first — enough to scrub immediately — then everything else. */
  var coarse = [];
  for (var i = 1; i <= FRAME_COUNT; i += 8) coarse.push(i);
  if (coarse[coarse.length - 1] !== FRAME_COUNT) coarse.push(FRAME_COUNT);

  var rest = [];
  for (var j = 1; j <= FRAME_COUNT; j++) if (coarse.indexOf(j) === -1) rest.push(j);

  /* ======================================================================
     2. CANVAS
     ====================================================================== */
  var canvas = document.getElementById('sequence');
  var ctx = canvas.getContext('2d', { alpha: false });
  var lastDrawn = -1;

  /* Returns true when the backing store actually changed, so callers can skip
     a redundant redraw. */
  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round((canvas.clientWidth || window.innerWidth) * dpr);
    var h = Math.round((canvas.clientHeight || window.innerHeight) * dpr);
    if (!w || !h || (w === canvas.width && h === canvas.height)) return false;
    canvas.width = w;
    canvas.height = h;
    lastDrawn = -1;
    return true;
  }

  function nearestLoaded(target) {
    if (loaded[target]) return target;
    for (var d = 1; d <= FRAME_COUNT; d++) {
      if (target - d >= 1 && loaded[target - d]) return target - d;
      if (target + d <= FRAME_COUNT && loaded[target + d]) return target + d;
    }
    return -1;
  }

  function drawFrame(n) {
    var idx = nearestLoaded(n);
    if (idx === -1 || idx === lastDrawn) return;
    var img = images[idx];
    if (!img) return;

    var cw = canvas.width, ch = canvas.height;
    var scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    var w = img.naturalWidth * scale;
    var h = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    lastDrawn = idx;
  }

  /* ======================================================================
     3. SCROLL SCRUB
     ====================================================================== */
  var hero = document.getElementById('hero');
  var caps = Array.prototype.slice.call(document.querySelectorAll('.cap'));
  var scrollcue = document.getElementById('scrollcue');
  var frameMeta = document.getElementById('frameMeta');

  /* [enter, exit] windows in scroll progress, aligned to the cuts in the
     footage: macro → flacon+materials → boutique → flacon → macro */
  var CAP_WINDOWS = [
    [0.000, 0.115],
    [0.170, 0.325],
    [0.410, 0.615],
    [0.710, 0.835],
    [0.900, 1.010]
  ];
  var RAMP = 0.055;

  function capOpacity(p, win) {
    var a = win[0], b = win[1];
    if (p < a - RAMP || p > b + RAMP) return 0;
    if (p < a) return (p - (a - RAMP)) / RAMP;
    if (p > b) return 1 - (p - b) / RAMP;
    return 1;
  }

  function heroProgress() {
    var total = hero.offsetHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / total, 0, 1);
  }

  var targetP = 0;
  var currentP = 0;
  var lastMeta = -1;

  function paint(p) {
    /* frame */
    var frame = Math.round(p * (FRAME_COUNT - 1)) + 1;
    drawFrame(frame);

    /* captions */
    for (var k = 0; k < caps.length; k++) {
      var o = capOpacity(p, CAP_WINDOWS[k]);
      caps[k].style.opacity = o;
      caps[k].style.transform = 'translateY(' + ((1 - o) * 26).toFixed(2) + 'px)';
      caps[k].style.visibility = o <= 0.001 ? 'hidden' : 'visible';
    }

    /* scroll cue */
    scrollcue.style.opacity = p > 0.015 ? 0 : 1;

    /* chapter meta */
    var chapter = 1;
    for (var m = 0; m < CAP_WINDOWS.length; m++) if (p >= CAP_WINDOWS[m][0]) chapter = m + 1;
    if (chapter !== lastMeta) {
      frameMeta.textContent = '0' + chapter + ' / 0' + CAP_WINDOWS.length;
      lastMeta = chapter;
    }
  }

  function tick() {
    targetP = heroProgress();
    /* smoothing — the scrub trails the scroll slightly, which reads as weight */
    currentP += (targetP - currentP) * 0.13;
    if (Math.abs(targetP - currentP) < 0.0002) currentP = targetP;
    paint(currentP);
    requestAnimationFrame(tick);
  }

  /* ======================================================================
     4. BOOT
     ====================================================================== */
  var loader = document.getElementById('loader');
  var loaderBar = document.getElementById('loaderBar');
  var loaderPct = document.getElementById('loaderPct');

  document.body.classList.add('is-loading');
  sizeCanvas();

  loadQueue(coarse, 6, function (ratio) {
    var pct = Math.round(ratio * 100);
    loaderBar.style.width = pct + '%';
    loaderPct.textContent = pct;
  }).then(function () {
    lastDrawn = -1;
    paint(0);
    setTimeout(function () {
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
    }, 380);

    /* fill in every remaining frame in the background */
    loadQueue(rest, 6, null).then(function () { lastDrawn = -1; });

    if (reduceMotion) {
      paint(0.35);
    } else {
      requestAnimationFrame(tick);
    }

    paintCardArt();
  });

  var resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (sizeCanvas()) paint(currentP);
    }, 120);
  }
  window.addEventListener('resize', handleResize);

  /* A window resize event is not guaranteed — a page opened in a background
     tab can lay out at zero height and gain its real size without one, which
     would leave the canvas blank. Watch the element itself. */
  if (window.ResizeObserver) {
    new ResizeObserver(handleResize).observe(canvas);
  }

  /* ======================================================================
     5. STILLS PULLED FROM THE SAME SEQUENCE
     ====================================================================== */
  function paintCardArt() {
    var els = document.querySelectorAll('[data-frame]');
    Array.prototype.forEach.call(els, function (el) {
      var n = clamp(parseInt(el.getAttribute('data-frame'), 10) || 1, 1, FRAME_COUNT);
      el.style.backgroundImage = 'url("' + framePath(n) + '")';
      /* frames that carry the burned-in material labels need the crop nudged
         right so the labels stay out of the still */
      var pos = el.getAttribute('data-pos');
      if (pos) el.style.backgroundPosition = pos + ' center';
    });
  }

  /* ======================================================================
     6. NAV / MENU / REVEALS / FORM
     ====================================================================== */
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function () {
    nav.classList.toggle('is-stuck', window.scrollY > 60);
  }, { passive: true });

  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  burger.addEventListener('click', function () {
    burger.classList.toggle('is-open');
    menu.classList.toggle('is-open');
  });
  Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
    a.addEventListener('click', function () {
      burger.classList.remove('is-open');
      menu.classList.remove('is-open');
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (el) {
    io.observe(el);
  });

  var form = document.getElementById('form');
  var formNote = document.getElementById('formNote');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formNote.textContent = 'Thank you — your request has been received.';
    form.reset();
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
