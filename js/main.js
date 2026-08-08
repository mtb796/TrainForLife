/* The Strong Academy — interactions
   Quiz funnel, two-month events calendar, Calendly scheduling, packages,
   newsletter, plus the scroll-reveal / parallax motion system. */
(function () {
  'use strict';

  /* ============================================================
     CONFIG DEFAULTS

     These are FALLBACKS ONLY. The live values come from
     content/site.json, which is edited through /admin (or directly
     on GitHub) — every save triggers a Vercel redeploy.

     If that file is missing or unreadable, the site quietly falls
     back to everything defined here, so it can never render blank.
     ============================================================ */

  // 1. CALENDLY — paste each service's scheduling link.
  //    Google Calendar sync (Iamcoachve@gmail.com, Hello@thestrongacademy.com)
  //    is connected inside Calendly's own Calendar Connections settings —
  //    no code change needed here once those accounts are linked.
  var CALENDLY = {
    discovery: '',  // e.g. 'https://calendly.com/thestrongacademy/discovery-call'
    single: '',     // e.g. 'https://calendly.com/thestrongacademy/1-1-session'
    team: '',       // e.g. 'https://calendly.com/thestrongacademy/teamstrong-class'
    workforce: ''   // e.g. 'https://calendly.com/thestrongacademy/workforce-consult'
  };

  // 2. EVENTBRITE — organizer page plus per-event ticket URLs.
  //    While `organizer` is empty the seeded schedule below is displayed.
  var EVENTBRITE = {
    organizer: '',  // e.g. 'https://www.eventbrite.com/o/the-strong-academy-XXXXXXXX'
    events: {}      // e.g. { 'Strong Camp L1': 'https://www.eventbrite.com/e/XXXXXXXX' }
  };

  // 3. PACKAGE CHECKOUT — Stripe/Square/Calendly paid-event links.
  //    Empty values send the visitor to the scheduler instead.
  var PACKAGES = {
    single:     { name: 'Single Session',        svc: 'single', checkoutUrl: '' },
    fourpack:   { name: 'Strong Start · 4-Pack', svc: 'single', checkoutUrl: '' },
    twelvepack: { name: 'The Commitment · 12-Pack', svc: 'single', checkoutUrl: '' }
  };

  /* ============================================================ */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var reducedMotion = (window.TSA && window.TSA.reducedMotion) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ shared state ============ */

  var state = { quizStep: 1, quizGoal: null, quizResult: null, selKey: null, monthOffset: 0, svc: 'discovery' };

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var SERVICES = [
    { id: 'discovery', name: 'Discovery Call', dur: '15 min', meta: 'Phone or video · find your fit' },
    { id: 'single', name: '1:1 Coaching Session', dur: '60 min', meta: 'Movement assessment included' },
    { id: 'team', name: 'TeamSTRONG Class', dur: '45 min', meta: 'Long Bridge Park · all levels' },
    { id: 'workforce', name: 'EverSTRONG at Work', dur: '30 min', meta: 'Workshops, pop-ups & proposals' }
  ];

  /* ============ events data ============
     Seeded schedule shown until EVENTBRITE.organizer is set.
     `soldOut: true` renders the SOLD OUT tag + Notify Me control. */

  function eventList() {
    function mk(off, title, meta, soldOut) {
      var d = new Date(today); d.setDate(d.getDate() + off);
      return { d: d, title: title, meta: meta, soldOut: !!soldOut };
    }
    return [
      mk(2,  'TeamSTRONG Outdoor Circuit', '6:00 PM · Long Bridge Park, Arlington', false),
      mk(4,  'EverSTRONG Class', '9:00 AM · semi-private 5:1', true),
      mk(5,  'Expert Seminar: Heart Health After 40', '10:00 AM · with guest cardiologist', false),
      mk(7,  'Strong Camp L1', '8:00 AM · six-week foundations camp', true),
      mk(9,  'EverSTRONG Class', '9:00 AM · semi-private 5:1', true),
      mk(11, 'TeamSTRONG Outdoor Circuit', '6:00 PM · Long Bridge Park, Arlington', false),
      mk(14, 'Strong Camp L1', '8:00 AM · six-week foundations camp', true),
      mk(16, 'EverSTRONG Class', '9:00 AM · semi-private 5:1', true),
      mk(19, 'Lunch & Learn: The Longevity Blueprint', '12:00 PM · corporate host', false),
      mk(21, 'Strong Camp L1', '8:00 AM · six-week foundations camp', true),
      mk(23, 'EverSTRONG Class', '9:00 AM · semi-private 5:1', true),
      mk(26, 'TeamSTRONG Outdoor Circuit', '6:00 PM · Long Bridge Park, Arlington', false),
      mk(30, 'EverSTRONG Class', '9:00 AM · semi-private 5:1', true),
      mk(35, 'Pop-Up: Free Mobility Screening', '9:00 AM · Long Bridge Park', false),
      mk(38, 'Strong Camp L1', '8:00 AM · six-week foundations camp', true),
      mk(44, 'EverSTRONG Class', '9:00 AM · semi-private 5:1', true)
    ];
  }

  var events = [];
  var evByKey = {};
  function dayKey(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }

  function indexEvents(list) {
    events = list.slice().sort(function (a, b) { return a.d - b.d; });
    evByKey = {};
    events.forEach(function (e) {
      (evByKey[dayKey(e.d)] = evByKey[dayKey(e.d)] || []).push(e);
    });
  }

  /* ============ quiz funnel ============ */

  var QUIZ_RESULTS = {
    ever: { name: 'EverSTRONG', desc: 'A complete longevity system: semi-private strength training (5:1), expert-led health seminars, and a community that sticks. Strength that ages as well as you do.' },
    team: { name: 'TeamSTRONG', desc: 'High Intentional HIIT + functional conditioning, scalable for every level. The group pushes you further than you would go alone.' },
    solo: { name: '1:1 Coaching', desc: 'Personalized longevity coaching with Venus Davis — baseline assessment, custom programming, and quarterly reassessments that prove your progress.' },
    corp: { name: 'EverSTRONG at Work', desc: 'Turnkey wellness for your organization: workshops, pop-up series, and group fitness experiences delivered at your location or ours.' }
  };
  var GOALS = [
    { label: 'Age strong & stay capable', v: 'ever' },
    { label: 'High Intentional conditioning', v: 'team' },
    { label: 'A personal transformation', v: 'solo' },
    { label: 'Wellness for my team', v: 'corp' }
  ];
  var STYLES = [
    { label: 'Small group + learning', v: 'ever' },
    { label: 'Big group energy', v: 'team' },
    { label: 'One-on-one attention', v: 'solo' },
    { label: 'At my workplace', v: 'corp' }
  ];
  var SVC_FOR_RESULT = { ever: 'discovery', team: 'team', solo: 'single', corp: 'workforce' };

  function resolveQuiz(goal, style) {
    if (goal === 'corp' || style === 'corp') return 'corp';
    if (style === 'solo') return 'solo';
    return style || goal;
  }

  var quizBody = $('#quizBody');

  function optionButton(label, onPick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'quiz-opt';
    b.textContent = label;
    b.addEventListener('click', onPick);
    return b;
  }

  function renderQuiz(focusFirst) {
    [1, 2, 3].forEach(function (n) {
      $('#quizBar' + n).classList.toggle('on', state.quizStep >= n);
    });
    quizBody.innerHTML = '';
    var step = document.createElement('div');
    step.className = 'quiz-step';

    if (state.quizStep === 1) {
      var q1 = document.createElement('p');
      q1.className = 'quiz-q';
      q1.textContent = "What's your main goal?";
      var grid1 = document.createElement('div');
      grid1.className = 'quiz-options';
      GOALS.forEach(function (g) {
        grid1.appendChild(optionButton(g.label, function () {
          state.quizGoal = g.v; state.quizStep = 2; renderQuiz(true);
        }));
      });
      step.appendChild(q1); step.appendChild(grid1);
    } else if (state.quizStep === 2) {
      var q2 = document.createElement('p');
      q2.className = 'quiz-q';
      q2.textContent = 'How do you like to train?';
      var grid2 = document.createElement('div');
      grid2.className = 'quiz-options';
      STYLES.forEach(function (s) {
        grid2.appendChild(optionButton(s.label, function () {
          state.quizResult = resolveQuiz(state.quizGoal, s.v);
          state.quizStep = 3; renderQuiz(true);
        }));
      });
      var back = document.createElement('button');
      back.type = 'button';
      back.className = 'quiz-back';
      back.textContent = '← Back';
      back.addEventListener('click', function () { state.quizStep = 1; renderQuiz(true); });
      step.appendChild(q2); step.appendChild(grid2); step.appendChild(back);
    } else {
      var r = QUIZ_RESULTS[state.quizResult];
      var card = document.createElement('div');
      card.className = 'quiz-result';
      card.innerHTML =
        '<p class="quiz-result-label">Your match</p>' +
        '<h3 class="quiz-result-name"></h3>' +
        '<p class="quiz-result-desc"></p>' +
        '<div class="quiz-result-ctas">' +
        '<a href="#book" class="btn btn-primary quiz-book"><span class="btn-label">Book a Discovery Call</span></a>' +
        '<button type="button" class="btn btn-ghost quiz-reset"><span class="btn-label">Start over</span></button>' +
        '</div>';
      card.querySelector('.quiz-result-name').textContent = r.name;
      card.querySelector('.quiz-result-desc').textContent = r.desc;
      card.querySelector('.quiz-book').addEventListener('click', function () {
        selectService(SVC_FOR_RESULT[state.quizResult] || 'discovery');
      });
      card.querySelector('.quiz-reset').addEventListener('click', function () {
        state.quizStep = 1; state.quizGoal = null; state.quizResult = null; renderQuiz(true);
      });
      step.appendChild(card);
    }
    quizBody.appendChild(step);
    // keep keyboard users anchored after the step swaps out
    if (focusFirst) {
      var first = step.querySelector('button, a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  /* ============ two-month calendar ============ */

  var calMonths = $('#calMonths');
  var calRange = $('#calRange');
  var eventsListEl = $('#eventsList');
  var clearDayBtn = $('#clearDay');
  var MONTHS_SHOWN = 2;

  function monthStart(offset) {
    return new Date(today.getFullYear(), today.getMonth() + offset, 1);
  }

  function renderMonth(base) {
    var wrap = document.createElement('div');
    var title = document.createElement('p');
    title.className = 'cal-month-title';
    title.textContent = MON_FULL[base.getMonth()] + ' ' + base.getFullYear();
    wrap.appendChild(title);

    var dow = document.createElement('div');
    dow.className = 'cal-dow';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d, i) {
      var c = document.createElement('div');
      c.textContent = d;
      c.setAttribute('aria-hidden', 'true');
      dow.appendChild(c);
    });
    wrap.appendChild(dow);

    var grid = document.createElement('div');
    grid.className = 'cal-grid';
    var daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    for (var i = 0; i < base.getDay(); i++) {
      var blank = document.createElement('div');
      blank.className = 'cal-cell blank';
      grid.appendChild(blank);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      (function (day) {
        var date = new Date(base.getFullYear(), base.getMonth(), day);
        var key = dayKey(date);
        var dayEvents = evByKey[key] || [];
        var has = dayEvents.length > 0;
        var cell = document.createElement(has ? 'button' : 'div');
        cell.className = 'cal-cell';
        if (has) {
          cell.type = 'button';
          cell.classList.add('has-events');
          if (dayEvents.every(function (e) { return e.soldOut; })) cell.classList.add('sold-out');
        }
        if (date.getTime() === today.getTime()) cell.classList.add('today');
        if (state.selKey === key) cell.classList.add('selected');
        var num = document.createElement('span');
        num.textContent = String(day);
        cell.appendChild(num);
        if (has) {
          var dot = document.createElement('span');
          dot.className = 'cal-dot';
          cell.appendChild(dot);
          cell.setAttribute('aria-label',
            MON_FULL[date.getMonth()] + ' ' + day + ' — ' + dayEvents.length + ' event' + (dayEvents.length > 1 ? 's' : ''));
          cell.setAttribute('aria-pressed', String(state.selKey === key));
          cell.addEventListener('click', function () {
            state.selKey = state.selKey === key ? null : key;
            renderCalendar();
            renderEvents();
          });
        }
        grid.appendChild(cell);
      })(d);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  function renderCalendar() {
    calMonths.innerHTML = '';
    for (var i = 0; i < MONTHS_SHOWN; i++) {
      calMonths.appendChild(renderMonth(monthStart(state.monthOffset + i)));
    }
    var first = monthStart(state.monthOffset);
    var last = monthStart(state.monthOffset + MONTHS_SHOWN - 1);
    calRange.textContent = MON[first.getMonth()].toUpperCase() + ' – ' +
      MON[last.getMonth()].toUpperCase() + ' ' + last.getFullYear();
    $('#calPrev').disabled = state.monthOffset <= 0;
  }

  $('#calPrev').addEventListener('click', function () {
    if (state.monthOffset > 0) { state.monthOffset--; state.selKey = null; renderCalendar(); renderEvents(); }
  });
  $('#calNext').addEventListener('click', function () {
    state.monthOffset++; state.selKey = null; renderCalendar(); renderEvents();
  });

  function ticketUrl(ev) {
    return EVENTBRITE.events[ev.title] || EVENTBRITE.organizer || '';
  }

  function renderEvents() {
    eventsListEl.innerHTML = '';
    var windowStart = monthStart(state.monthOffset);
    var windowEnd = new Date(monthStart(state.monthOffset + MONTHS_SHOWN).getTime() - 1);

    var shown = state.selKey
      ? (evByKey[state.selKey] || [])
      : events.filter(function (e) {
          return e.d >= (state.monthOffset === 0 ? today : windowStart) && e.d <= windowEnd;
        }).slice(0, 5);

    if (!shown.length) {
      var empty = document.createElement('p');
      empty.className = 'events-empty';
      empty.textContent = state.selKey
        ? 'No events on this day.'
        : 'No events scheduled in this range — try the next month.';
      eventsListEl.appendChild(empty);
    }

    shown.forEach(function (e, i) {
      var row = document.createElement('div');
      row.className = 'event-row';
      row.style.setProperty('--i', i);
      row.innerHTML =
        '<div class="event-date"><p class="event-day"></p><p class="event-mon"></p></div>' +
        '<div class="event-info"><p class="event-title"></p><p class="event-meta"></p></div>';
      row.querySelector('.event-day').textContent = String(e.d.getDate());
      row.querySelector('.event-mon').textContent = MON[e.d.getMonth()].toUpperCase();

      var titleEl = row.querySelector('.event-title');
      titleEl.appendChild(document.createTextNode(e.title));
      if (e.soldOut) {
        var tag = document.createElement('span');
        tag.className = 'sold-out-tag';
        tag.textContent = 'Sold out';
        titleEl.appendChild(tag);
      }
      row.querySelector('.event-meta').textContent =
        e.d.toLocaleDateString('en-US', { weekday: 'long' }) + ' · ' + e.meta;

      if (e.soldOut) {
        var notify = document.createElement('button');
        notify.type = 'button';
        notify.className = 'event-cta notify';
        notify.innerHTML = 'Notify me <span class="arrow-glyph">→</span>';
        notify.addEventListener('click', function () {
          notify.classList.add('notified');
          notify.classList.remove('notify');
          notify.textContent = '✦ On the waitlist';
          notify.disabled = true;
          var news = document.getElementById('newsEmail');
          if (news) news.focus({ preventScroll: false });
        });
        row.appendChild(notify);
      } else {
        var link = document.createElement('a');
        link.className = 'event-cta';
        link.href = ticketUrl(e) || '#book';
        if (ticketUrl(e)) { link.target = '_blank'; link.rel = 'noopener'; }
        link.innerHTML = 'Save spot <span class="arrow-glyph">→</span>';
        row.appendChild(link);
      }
      eventsListEl.appendChild(row);
    });

    if (state.selKey) {
      var parts = state.selKey.split('-');
      clearDayBtn.hidden = false;
      clearDayBtn.textContent = 'Showing ' + MON[+parts[1]] + ' ' + parts[2] + ' — show all ✕';
    } else {
      clearDayBtn.hidden = true;
    }
  }

  clearDayBtn.addEventListener('click', function () {
    state.selKey = null;
    renderCalendar();
    renderEvents();
  });

  /* ============ booking — Calendly ============ */

  var svcList = $('#svcList');
  var scheduler = $('#scheduler');
  var calendlyLoading = null;

  function loadCalendly() {
    if (window.Calendly) return Promise.resolve();
    if (calendlyLoading) return calendlyLoading;
    calendlyLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return calendlyLoading;
  }

  // brand the embedded widget to match the site
  function brandedUrl(url) {
    return url + (url.indexOf('?') > -1 ? '&' : '?') +
      'background_color=000000&text_color=EFE7E2&primary_color=8400C8';
  }

  function renderScheduler() {
    var url = CALENDLY[state.svc];
    scheduler.innerHTML = '';

    if (!url) {
      var svc = SERVICES.find(function (s) { return s.id === state.svc; });
      var ph = document.createElement('div');
      ph.className = 'scheduler-placeholder';
      ph.innerHTML =
        '<p class="sp-mark" aria-hidden="true">✦</p>' +
        '<h3></h3>' +
        '<p></p>' +
        '<p><code>CALENDLY.' + state.svc + '</code></p>';
      ph.querySelector('h3').textContent = svc.name;
      ph.querySelector('p:nth-of-type(2)').textContent =
        'Scheduling for this service goes live as soon as its Calendly link is added in js/main.js.';
      scheduler.appendChild(ph);
      return;
    }

    var host = document.createElement('div');
    host.className = 'calendly-inline-widget';
    scheduler.appendChild(host);
    loadCalendly().then(function () {
      window.Calendly.initInlineWidget({ url: brandedUrl(url), parentElement: host });
    }).catch(function () {
      scheduler.innerHTML = '<div class="scheduler-placeholder"><p>Scheduling is temporarily unavailable. ' +
        'Email <a href="mailto:hello@thestrongacademy.com">hello@thestrongacademy.com</a> and we\'ll get you booked.</p></div>';
    });
  }

  function renderServices() {
    svcList.innerHTML = '';
    SERVICES.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'svc-card' + (state.svc === s.id ? ' selected' : '');
      b.setAttribute('aria-pressed', String(state.svc === s.id));
      b.innerHTML = '<span class="svc-top"><span class="svc-name"></span><span class="svc-price"></span></span><span class="svc-meta"></span>';
      b.querySelector('.svc-name').textContent = s.name;
      b.querySelector('.svc-price').textContent = s.dur;
      b.querySelector('.svc-meta').textContent = s.meta;
      b.addEventListener('click', function () { selectService(s.id); });
      svcList.appendChild(b);
    });
  }

  function selectService(id, scroll) {
    state.svc = id;
    renderServices();
    renderScheduler();
    if (scroll !== false) {
      document.getElementById('book').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }

  // "Book another" inside Calendly's own flow returns to the scheduler
  window.addEventListener('message', function (e) {
    if (e.data && typeof e.data.event === 'string' && e.data.event === 'calendly.event_scheduled') {
      var again = document.createElement('button');
      again.type = 'button';
      again.className = 'btn btn-ghost';
      again.innerHTML = '<span class="btn-label">Book another</span>';
      again.addEventListener('click', renderScheduler);
      var bar = document.createElement('div');
      bar.style.cssText = 'padding:16px;text-align:center';
      bar.appendChild(again);
      scheduler.appendChild(bar);
    }
  });

  /* ============ packages ============ */

  document.querySelectorAll('[data-package]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pkg = PACKAGES[btn.dataset.package];
      if (!pkg) return;
      if (pkg.checkoutUrl) {
        window.open(pkg.checkoutUrl, '_blank', 'noopener');
        return;
      }
      // no checkout link yet — send them to the scheduler for that service
      selectService(pkg.svc);
    });
  });

  /* ============ testimonials ============ */

  // The three quotes in index.html are the no-JS fallback. They are only
  // replaced when site.json actually supplies quotes, so a failed fetch
  // leaves real content on the page rather than an empty grid.
  function renderTestimonials(list) {
    if (!list || !list.length) return;
    var wrap = document.querySelector('.testimonials');
    if (!wrap) return;
    wrap.innerHTML = '';
    list.forEach(function (t, i) {
      var fig = document.createElement('figure');
      fig.className = 'quote-card reveal in';
      fig.style.setProperty('--i', i);
      var q = document.createElement('p');
      q.className = 'quote';
      q.textContent = '“' + t.quote + '”';
      var cap = document.createElement('figcaption');
      cap.textContent = t.who;
      fig.appendChild(q);
      fig.appendChild(cap);
      wrap.appendChild(fig);
    });
  }

  /* ============ content loading ============ */

  function parseDate(s) {
    // Parse as local midnight — `new Date("2026-08-04")` is UTC and can
    // land on the previous day in western timezones.
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function applyContent(c) {
    if (!c) return;
    var i = c.integrations || {};
    if (i.calendly) Object.keys(CALENDLY).forEach(function (k) {
      if (typeof i.calendly[k] === 'string') CALENDLY[k] = i.calendly[k];
    });
    if (i.eventbrite) {
      if (typeof i.eventbrite.organizer === 'string') EVENTBRITE.organizer = i.eventbrite.organizer;
      if (i.eventbrite.events) EVENTBRITE.events = i.eventbrite.events;
    }
    if (i.packages) Object.keys(PACKAGES).forEach(function (k) {
      if (typeof i.packages[k] === 'string') PACKAGES[k].checkoutUrl = i.packages[k];
    });
    if (Array.isArray(c.events) && c.events.length) {
      indexEvents(c.events.map(function (e) {
        return { d: parseDate(e.date), title: e.title, meta: e.meta, soldOut: !!e.soldOut };
      }));
    }
    renderTestimonials(c.testimonials);
  }

  function boot(content) {
    try { applyContent(content); } catch (err) { /* keep the built-in defaults */ }
    if (!events.length) indexEvents(eventList());
    renderQuiz(false);
    renderCalendar();
    renderEvents();
    renderServices();
    renderScheduler();

    // ?svc=workforce#book — deep link from the EverSTRONG at Work page.
    // Must live here, not in selectService(), or selecting a service would
    // re-read the param and call itself forever.
    var wanted = new URLSearchParams(location.search).get('svc');
    if (wanted && SERVICES.some(function (s) { return s.id === wanted; })) {
      selectService(wanted, false);
    }

    console.log('%cBe well. Stay committed. Train for life. ✦', 'color:#8400C8;font-size:14px;letter-spacing:2px');
  }

  if (window.__SITE_CONTENT__) {
    // Single-file/offline build: content is inlined rather than fetched.
    boot(window.__SITE_CONTENT__);
  } else if (window.fetch && location.protocol !== 'file:') {
    fetch('content/site.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(boot)
      .catch(function () { boot(null); });
  } else {
    boot(null); // opened straight from disk — use built-in defaults
  }
})();
