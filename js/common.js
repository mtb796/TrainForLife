/* The Strong Academy — shared page chrome
   Nav, scroll progress, reveal animations, parallax and magnetic CTAs.
   Loaded by every page; every lookup is null-safe so a page can omit
   any of these elements without breaking. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.TSA = { reducedMotion: reducedMotion };

  /* ---------- nav ---------- */

  var nav = $('#nav');
  var navToggle = $('#navToggle');
  var navLinks = $('#navLinks');
  var progressBar = $('.scroll-progress');
  var lastY = window.scrollY;

  function onScroll() {
    var y = window.scrollY;
    if (nav) {
      nav.classList.toggle('scrolled', y > 10);
      if (!navLinks || !navLinks.classList.contains('open')) {
        if (y > 320 && y - lastY > 4) nav.classList.add('hidden');
        else if (y - lastY < -4 || y <= 320) nav.classList.remove('hidden');
      }
    }
    lastY = y;
    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // highlight the nav link of the section currently in view
  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = document.querySelector('.nav-link[data-section="' + entry.target.id + '"]');
        if (link) link.classList.toggle('active', entry.isIntersecting);
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('.nav-link[data-section]').forEach(function (link) {
      var el = document.getElementById(link.dataset.section);
      if (el) navObserver.observe(el);
    });
  }

  /* ---------- kinetic headings: per-word masks ---------- */

  function splitWords(el) {
    var wordIndex = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === Node.TEXT_NODE) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              var w = document.createElement('span');
              w.className = 'w';
              var wi = document.createElement('span');
              wi.className = 'wi';
              wi.style.setProperty('--wi', wordIndex++);
              wi.textContent = part;
              w.appendChild(wi);
              frag.appendChild(w);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    })(el);
    el.classList.add('split');
  }

  if (!reducedMotion) {
    try {
      document.querySelectorAll('.reveal-lines').forEach(splitWords);
    } catch (e) { /* headings fall back to the unsplit reveal */ }
  }

  /* ---------- scroll reveals ---------- */

  var revealEls = document.querySelectorAll('.reveal, .reveal-lines');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }
  // expose so dynamically-rendered content can opt in
  window.TSA.revealNow = function (el) { if (el) el.classList.add('in'); };

  /* ---------- scroll-linked motion ---------- */

  var heroImg = $('#heroImg');
  var hero = $('.hero');
  var heroContent = $('.hero-content');
  var scrollCue = $('.hero-scrollcue');
  var plxEls = Array.prototype.slice.call(document.querySelectorAll('[data-plx]'));

  if (!reducedMotion && (hero || plxEls.length)) {
    var ticking = false;
    var applyMotion = function () {
      var y = window.scrollY;
      var vh = window.innerHeight;
      if (hero && heroImg && heroContent) {
        var h = hero.offsetHeight;
        if (y < h) {
          heroImg.style.transform = 'translateY(' + (y * 0.25) + 'px)';
          heroContent.style.opacity = Math.max(0, 1 - y / (h * 0.75));
          heroContent.style.transform = 'translateY(' + (y * 0.16) + 'px)';
        }
      }
      if (scrollCue) scrollCue.style.opacity = Math.max(0, 1 - y / 240);
      plxEls.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        el.style.transform = 'translateY(' + (progress * parseFloat(el.dataset.plx)) + 'px)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(applyMotion);
    }, { passive: true });
    applyMotion();
  }

  /* ---------- magnetic CTAs (desktop pointers only) ---------- */

  if (!reducedMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) * 0.25;
        var dy = (e.clientY - r.top - r.height / 2) * 0.35;
        el.style.transition = 'transform 0.15s ease-out';
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate(0, 0)';
      });
    });
  }
})();
