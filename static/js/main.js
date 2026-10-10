/* Interactive parts of the RECON project page: math rendering, the contents
 * bar, the training/inference tabs, the training-iteration viewer, the
 * denoising probe, the image lightbox and the BibTeX copy button. No
 * dependencies. */
(function () {
  'use strict';

  var SAMPLES = 'static/images/samples/';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------- math */

  // Called from the onload of KaTeX's auto-render script (and on window load
  // as a fallback, whichever comes first).
  var mathDone = false;
  window.renderMath = function () {
    if (mathDone || typeof window.renderMathInElement !== 'function') return;
    mathDone = true;
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      throwOnError: false
    });
  };
  window.addEventListener('load', window.renderMath);

  function preload(urls) {
    var run = function () { urls.forEach(function (u) { var i = new Image(); i.src = u; }); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 1200);
  }

  /* ------------------------------------------------------- contents bar */

  function initToc() {
    var toc = document.querySelector('.toc');
    if (!toc) return;
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var article = document.querySelector('d-article');
    var appendix = document.querySelector('d-appendix');
    var wide = Array.prototype.slice.call(document.querySelectorAll('d-article .l-page, d-article .l-body-outset'));
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY, vh = window.innerHeight;
      var articleTop = article.getBoundingClientRect().top + y;
      var end = appendix ? appendix.getBoundingClientRect().top + y : document.body.scrollHeight;
      toc.classList.toggle('visible', y > articleTop - 40 && y + vh * 0.4 < end);
      // On screens where the bar sits beside the text, step aside for wide figures.
      var tucked = false;
      if (window.getComputedStyle(toc).position === 'fixed') {
        var tr = toc.getBoundingClientRect();
        wide.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.left < tr.right + 12 && r.bottom > tr.top - 16 && r.top < tr.bottom + 16) tucked = true;
        });
      }
      toc.classList.toggle('tucked', tucked);
      var current = null;
      targets.forEach(function (t) {
        if (t && t.getBoundingClientRect().top - vh * 0.3 <= 0) current = t;
      });
      links.forEach(function (a, i) { a.classList.toggle('active', targets[i] === current); });
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* --------------------------------------- REPA vs RECON over training */

  var SCALING_CLASSES = [
    { id: 'eagle', name: 'eagle' },
    { id: 'cockatoo', name: 'cockatoo' },
    { id: 'fox', name: 'white fox' },
    { id: 'squirrel', name: 'squirrel' },
    { id: 'balloon', name: 'hot-air balloon' }
  ];
  var ITER_LABEL = { '50k': '50K', '100k': '100K', '400k': '400K' };

  function initScaling() {
    var root = document.getElementById('scaling-viewer');
    if (!root) return;
    var thumbs = root.querySelector('.thumbs');
    var cells = Array.prototype.slice.call(root.querySelectorAll('img[data-method]'));
    var buttons = [];

    function src(cls, method, iter) {
      return SAMPLES + 'scaling/' + cls + '_' + method + '_' + iter + '.jpg';
    }

    function show(i) {
      var cls = SCALING_CLASSES[i];
      cells.forEach(function (img) {
        var m = img.getAttribute('data-method'), it = img.getAttribute('data-iter');
        img.src = src(cls.id, m, it);
        img.alt = (m === 'repa' ? 'REPA' : 'RECON') + ' sample of a ' + cls.name + ' after ' + ITER_LABEL[it] + ' training iterations';
      });
      buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === i)); b.classList.toggle('active', j === i); });
    }

    SCALING_CLASSES.forEach(function (cls, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb';
      b.setAttribute('aria-label', 'Show the ' + cls.name + ' samples');
      b.innerHTML = '<img src="' + src(cls.id, 'recon', '400k') + '" alt="">';
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var j = (i + (e.key === 'ArrowRight' ? 1 : SCALING_CLASSES.length - 1)) % SCALING_CLASSES.length;
          show(j); buttons[j].focus();
        }
      });
      thumbs.appendChild(b);
      buttons.push(b);
    });

    show(0);
    var urls = [];
    SCALING_CLASSES.forEach(function (c) {
      ['repa', 'recon'].forEach(function (m) { Object.keys(ITER_LABEL).forEach(function (it) { urls.push(src(c.id, m, it)); }); });
    });
    preload(urls);
  }

  /* ---------------------------------------------------- denoising probe */

  var TS = ['80', '70', '60', '50', '40', '30', '20', '10', '00'];
  var DENOISE_EXAMPLES = ['dog in autumn leaves', 'sitting puppy', 'cockatoo'];

  function initDenoise() {
    var root = document.getElementById('denoise-viewer');
    if (!root) return;
    var thumbs = root.querySelector('.thumbs');
    var imgIn = root.querySelector('[data-pane="input"]');
    var imgRepa = root.querySelector('[data-pane="repa"]');
    var imgRecon = root.querySelector('[data-pane="recon"]');
    var slider = root.querySelector('input.tslider');
    var readout = root.querySelector('.t-readout');
    var ticks = Array.prototype.slice.call(root.querySelectorAll('.ticks span'));
    var playBtn = root.querySelector('.play-btn');
    var ex = 0, step = 0, timer = null, buttons = [];
    var PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
    var PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/></svg>';

    function frame(e, m, t) { return SAMPLES + 'denoise/ex' + e + '_' + m + '_t' + t + '.jpg'; }

    function render() {
      var t = TS[step];
      var label = 't = ' + (parseInt(t, 10) / 100).toFixed(2);
      imgIn.src = SAMPLES + 'denoise/ex' + ex + '_input.jpg';
      imgRepa.src = frame(ex, 'repa', t);
      imgRecon.src = frame(ex, 'recon', t);
      imgRepa.alt = 'REPA estimate of the clean image at ' + label;
      imgRecon.alt = 'RECON estimate of the clean image at ' + label;
      readout.textContent = label;
      slider.value = String(step);
      slider.setAttribute('aria-valuetext', label);
      ticks.forEach(function (s, i) { s.classList.toggle('on', i === step); });
      buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === ex)); b.classList.toggle('active', j === ex); });
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      playBtn.innerHTML = PLAY;
      playBtn.setAttribute('aria-label', 'Play the denoising trajectory');
    }

    function play() {
      if (step >= TS.length - 1) step = 0;
      render();
      playBtn.innerHTML = PAUSE;
      playBtn.setAttribute('aria-label', 'Pause');
      timer = setInterval(function () {
        if (step >= TS.length - 1) { stop(); return; }
        step += 1;
        render();
      }, 560);
    }

    DENOISE_EXAMPLES.forEach(function (name, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb';
      b.setAttribute('aria-label', 'Show example ' + (i + 1) + ' (' + name + ')');
      b.innerHTML = '<img src="' + SAMPLES + 'denoise/ex' + i + '_input.jpg" alt="">';
      b.addEventListener('click', function () { stop(); ex = i; step = 0; render(); if (!reduceMotion) play(); });
      thumbs.appendChild(b);
      buttons.push(b);
    });

    playBtn.addEventListener('click', function () { if (timer) stop(); else play(); });
    slider.addEventListener('input', function () { stop(); step = parseInt(slider.value, 10); render(); });
    ticks.forEach(function (s, i) {
      s.style.cursor = 'pointer';
      s.addEventListener('click', function () { stop(); step = i; render(); });
    });

    stop();
    render();

    var urls = [];
    for (var e = 0; e < DENOISE_EXAMPLES.length; e++) {
      TS.forEach(function (t) { urls.push(frame(e, 'repa', t), frame(e, 'recon', t)); });
    }
    preload(urls);

    // Play once when the viewer first scrolls into view.
    if (!reduceMotion && 'IntersectionObserver' in window) {
      var seen = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio > 0.55 && !seen) {
            seen = true;
            setTimeout(play, 350);
            io.disconnect();
          }
        });
      }, { threshold: [0.55] });
      io.observe(root.querySelector('.denoise-stage'));
    }
  }

  /* -------------------- tabs: training / inference, results, hyperparameters */

  function initTabs(id) {
    var root = document.getElementById(id);
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));

    function select(i, focus) {
      tabs.forEach(function (tab, j) {
        var on = j === i;
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        panel.hidden = !on;
        // Restart the clip, so it plays from the beginning when the tab is opened.
        var img = panel.querySelector('img');
        if (on && img) {
          var base = img.getAttribute('data-src') || img.getAttribute('src');
          img.setAttribute('data-src', base);
          img.src = base + '?play=' + Date.now();
        }
      });
      if (focus) tabs[i].focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        if (tab.getAttribute('aria-selected') !== 'true') select(i, false);
      });
      tab.addEventListener('keydown', function (e) {
        var n = tabs.length, j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % n;
        else if (e.key === 'ArrowLeft') j = (i + n - 1) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j !== null) { e.preventDefault(); select(j, true); }
      });
    });
  }

  /* ----------------------------------------------------------- lightbox */

  function initLightbox() {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Enlarged figure');
    box.innerHTML = '<button class="lb-close" type="button" aria-label="Close">&times;</button><img alt="">';
    document.body.appendChild(box);
    var big = box.querySelector('img');
    var lastFocus = null;

    function open(img) {
      var isSvg = /\.svg(\?|$)/i.test(img.currentSrc || img.src);
      var nw = img.naturalWidth || 1000, nh = img.naturalHeight || 700;
      var maxW = window.innerWidth * 0.94, maxH = window.innerHeight * 0.9;
      var w = isSvg ? Math.min(maxW, 1100) : Math.min(nw * 2, maxW);
      var h = w * nh / nw;
      if (h > maxH) { h = maxH; w = h * nw / nh; }
      big.src = img.currentSrc || img.src;
      big.alt = img.alt || '';
      big.style.width = Math.round(w) + 'px';
      big.style.height = Math.round(h) + 'px';
      lastFocus = document.activeElement;
      box.classList.add('open');
      box.querySelector('.lb-close').focus();
    }

    function close() {
      if (!box.classList.contains('open')) return;
      box.classList.remove('open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener('click', function (e) {
      var img = e.target.closest ? e.target.closest('img.zoomable') : null;
      if (img) { e.preventDefault(); open(img); }
    });
    box.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* --------------------------------------------------------- copy BibTeX */

  function initCopy() {
    Array.prototype.forEach.call(document.querySelectorAll('.copy-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var text = document.getElementById(btn.getAttribute('data-target')).textContent.trim();
        var done = function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
        };
        var fallback = function () {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (err) { /* nothing else to try */ }
          document.body.removeChild(ta);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
      });
    });
  }

  function init() {
    initToc();
    initTabs('pipeline');
    initTabs('c2i-tables');
    initTabs('hparams');
    initScaling();
    initDenoise();
    initLightbox();
    initCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
