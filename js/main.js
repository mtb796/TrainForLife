/* The Strong Academy — interactions
   Quiz funnel, events calendar, booking flow, newsletter (all prototype-only;
   wire booking + newsletter to real services in production), plus the
   scroll-reveal / parallax motion system. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ nav ============ */

  var nav = $('#nav');
  var navToggle = $('#navToggle');
  var navLinks = $('#navLinks');
  var progressBar = $('.scroll-progress');

  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 10);
    if (progressBar) {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      progressBar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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

  // highlight the nav link of the section in view
  var sectionIds = ['programs', 'events', 'pricing', 'about'];
  if ('IntersectionObserver' in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = document.querySelector('.nav-link[data-section="' + entry.target.id + '"]');
        if (link) link.classList.toggle('active', entry.isIntersecting);
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sectionIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) navObserver.observe(el);
    });
  }

  /* ============ scroll reveals ============ */

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

  /* ============ hero parallax ============ */

  var heroImg = $('#heroImg');
  var hero = $('.hero');
  if (heroImg && !reducedMotion) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var h = hero.offsetHeight;
        var y = window.scrollY;
        if (y < h) heroImg.style.transform = 'translateY(' + (y * 0.25) + 'px)';
        ticking = false;
      });
    }, { passive: true });
  }

  /* ============ shared state ============ */

  var state = {
    quizStep: 1, quizGoal: null, quizResult: null,
    selDay: null,
    svc: 'discovery', dayOff: 1, slot: null,
    booked: false
  };

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var SERVICES = [
    { id: 'discovery', name: 'Discovery Call', price: 'Free', meta: '20 min · phone or video · find your fit' },
    { id: 'single', name: '1:1 Coaching Session', price: '$165', meta: '60 min · movement assessment included' },
    { id: 'team', name: 'TeamSTRONG Class', price: 'Drop-in', meta: '45 min · Long Bridge Park · all levels' },
    { id: 'consult', name: 'Corporate Consult', price: 'Free', meta: '30 min · workshops, pop-ups & proposals' }
  ];

  function slotTimes(svcId, date) {
    var dow = date.getDay();
    if (svcId === 'team') return dow === 6 ? ['9:00 AM'] : (dow === 2 || dow === 4 ? ['6:00 PM'] : []);
    if (svcId === 'single') return ['7:00 AM', '9:00 AM', '12:00 PM', '4:30 PM', '6:00 PM'];
    return ['9:30 AM', '11:00 AM', '1:00 PM', '3:30 PM', '5:00 PM'];
  }

  // placeholder events relative to today; replace with CMS / booking API data
  function eventList() {
    function mk(off, title, meta) {
      var d = new Date(today); d.setDate(d.getDate() + off);
      return { d: d, title: title, meta: meta };
    }
    return [
      mk(2, 'TeamSTRONG Outdoor Circuit', '6:00 PM · Long Bridge Park, Arlington'),
      mk(4, 'TeamSTRONG Outdoor Circuit', '6:00 PM · Long Bridge Park, Arlington'),
      mk(5, 'Expert Seminar: Heart Health After 40', '10:00 AM · with guest cardiologist (placeholder)'),
      mk(7, 'EverSTRONG Community Social Hour', '5:30 PM · post-session meetup'),
      mk(11, 'Pop-Up: Free Mobility Screening', '9:00 AM · Long Bridge Park'),
      mk(14, 'EverSTRONG Pilot — New Cohort Kickoff', '9:00 AM · limited to 12 spots'),
      mk(19, 'Lunch & Learn: The Longevity Blueprint', '12:00 PM · corporate host (placeholder)')
    ];
  }

  /* ============ quiz funnel ============ */

  var QUIZ_RESULTS = {
    ever: { name: 'EverSTRONG', desc: 'A complete longevity system: semi-private strength training (4:1), expert-led health seminars, and a community that sticks. Strength that ages as well as you do.' },
    team: { name: 'TeamSTRONG', desc: 'High-energy HIIT + functional conditioning, scalable for every level. The group pushes you further than you would go alone.' },
    solo: { name: '1:1 Coaching', desc: 'Personalized longevity coaching with Venus Davis — baseline assessment, custom programming, and quarterly reassessments that prove your progress.' },
    corp: { name: 'Corporate & Community', desc: 'Turnkey wellness for your organization: workshops, pop-up series, and group fitness experiences delivered at your location or ours.' }
  };
  var GOALS = [
    { label: 'Age strong & stay capable', v: 'ever' },
    { label: 'High-energy conditioning', v: 'team' },
    { label: 'A personal transformation', v: 'solo' },
    { label: 'Wellness for my team', v: 'corp' }
  ];
  var STYLES = [
    { label: 'Small group + learning', v: 'ever' },
    { label: 'Big group energy', v: 'team' },
    { label: 'One-on-one attention', v: 'solo' },
    { label: 'At my workplace', v: 'corp' }
  ];
  var SVC_FOR_RESULT = { ever: 'discovery', team: 'team', solo: 'single', corp: 'consult' };

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

  function renderQuiz() {
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
          state.quizGoal = g.v; state.quizStep = 2; renderQuiz();
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
          state.quizStep = 3; renderQuiz();
        }));
      });
      var back = document.createElement('button');
      back.type = 'button';
      back.className = 'quiz-back';
      back.textContent = '← Back';
      back.addEventListener('click', function () { state.quizStep = 1; renderQuiz(); });
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
        '<a href="#book" class="btn btn-primary quiz-book">Book a Discovery Call</a>' +
        '<button type="button" class="btn btn-ghost quiz-reset">Start over</button>' +
        '</div>';
      card.querySelector('.quiz-result-name').textContent = r.name;
      card.querySelector('.quiz-result-desc').textContent = r.desc;
      card.querySelector('.quiz-book').addEventListener('click', function () {
        state.svc = SVC_FOR_RESULT[state.quizResult] || 'discovery';
        state.slot = null;
        renderBooking();
      });
      card.querySelector('.quiz-reset').addEventListener('click', function () {
        state.quizStep = 1; state.quizGoal = null; state.quizResult = null; renderQuiz();
      });
      step.appendChild(card);
    }
    quizBody.appendChild(step);
  }

  /* ============ events calendar ============ */

  var calGrid = $('#calGrid');
  var calDow = $('#calDow');
  var eventsListEl = $('#eventsList');
  var clearDayBtn = $('#clearDay');
  var events = eventList();
  var evByDay = {};
  events.forEach(function (e) {
    if (e.d.getMonth() === today.getMonth() && e.d.getFullYear() === today.getFullYear()) {
      (evByDay[e.d.getDate()] = evByDay[e.d.getDate()] || []).push(e);
    }
  });

  $('#monthLabel').textContent = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach(function (d) {
    var cell = document.createElement('div');
    cell.textContent = d;
    calDow.appendChild(cell);
  });

  function renderCalendar() {
    calGrid.innerHTML = '';
    var first = new Date(today.getFullYear(), today.getMonth(), 1);
    var daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    var i, d;
    for (i = 0; i < first.getDay(); i++) {
      var blank = document.createElement('div');
      blank.className = 'cal-cell blank';
      calGrid.appendChild(blank);
    }
    for (d = 1; d <= daysInMonth; d++) {
      (function (day) {
        var has = !!evByDay[day];
        var cell = document.createElement(has ? 'button' : 'div');
        if (has) cell.type = 'button';
        cell.className = 'cal-cell';
        if (has) cell.classList.add('has-events');
        if (day === today.getDate()) cell.classList.add('today');
        if (state.selDay === day) cell.classList.add('selected');
        var num = document.createElement('span');
        num.textContent = String(day);
        cell.appendChild(num);
        if (has) {
          var dot = document.createElement('span');
          dot.className = 'cal-dot';
          cell.appendChild(dot);
          cell.setAttribute('aria-label', MON[today.getMonth()] + ' ' + day + ' — view events');
          cell.setAttribute('aria-pressed', String(state.selDay === day));
          cell.addEventListener('click', function () {
            state.selDay = state.selDay === day ? null : day;
            renderCalendar();
            renderEvents();
          });
        }
        calGrid.appendChild(cell);
      })(d);
    }
  }

  function renderEvents() {
    eventsListEl.innerHTML = '';
    var shown = state.selDay
      ? (evByDay[state.selDay] || [])
      : events.filter(function (e) { return e.d >= today; }).slice(0, 4);

    if (!shown.length) {
      var empty = document.createElement('p');
      empty.className = 'events-empty';
      empty.textContent = 'No events on this day.';
      eventsListEl.appendChild(empty);
    }
    shown.forEach(function (e, i) {
      var row = document.createElement('div');
      row.className = 'event-row';
      row.style.setProperty('--i', i);
      row.innerHTML =
        '<div class="event-date"><p class="event-day"></p><p class="event-mon"></p></div>' +
        '<div class="event-info"><p class="event-title"></p><p class="event-meta"></p></div>' +
        '<a href="#book" class="event-cta">Save spot →</a>';
      row.querySelector('.event-day').textContent = String(e.d.getDate());
      row.querySelector('.event-mon').textContent = MON[e.d.getMonth()].toUpperCase();
      row.querySelector('.event-title').textContent = e.title;
      row.querySelector('.event-meta').textContent =
        e.d.toLocaleDateString('en-US', { weekday: 'long' }) + ' · ' + e.meta;
      eventsListEl.appendChild(row);
    });

    if (state.selDay) {
      clearDayBtn.hidden = false;
      clearDayBtn.textContent = 'Showing ' + MON[today.getMonth()] + ' ' + state.selDay + ' — show all ✕';
    } else {
      clearDayBtn.hidden = true;
    }
  }

  clearDayBtn.addEventListener('click', function () {
    state.selDay = null;
    renderCalendar();
    renderEvents();
  });

  /* ============ booking flow ============ */

  var svcList = $('#svcList');
  var dayGrid = $('#dayGrid');
  var slotWrap = $('#slotWrap');
  var bkError = $('#bkError');

  function selectedDate() {
    var d = new Date(today); d.setDate(d.getDate() + state.dayOff);
    return d;
  }

  function svcName() {
    var s = SERVICES.find(function (v) { return v.id === state.svc; });
    return s ? s.name : '';
  }

  function bookSummary() {
    var dateLabel = selectedDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return svcName() + ' · ' + dateLabel + (state.slot ? ' · ' + state.slot : ' · pick a time');
  }

  function renderBooking() {
    // services
    svcList.innerHTML = '';
    SERVICES.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'svc-card' + (state.svc === s.id ? ' selected' : '');
      b.setAttribute('aria-pressed', String(state.svc === s.id));
      b.innerHTML = '<span class="svc-top"><span class="svc-name"></span><span class="svc-price"></span></span><span class="svc-meta"></span>';
      b.querySelector('.svc-name').textContent = s.name;
      b.querySelector('.svc-price').textContent = s.price;
      b.querySelector('.svc-meta').textContent = s.meta;
      b.addEventListener('click', function () {
        state.svc = s.id; state.slot = null; renderBooking();
      });
      svcList.appendChild(b);
    });

    // days
    dayGrid.innerHTML = '';
    for (var i = 1; i <= 10; i++) {
      (function (off) {
        var d = new Date(today); d.setDate(d.getDate() + off);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'day-cell' + (state.dayOff === off ? ' selected' : '');
        b.setAttribute('aria-pressed', String(state.dayOff === off));
        b.innerHTML = '<span class="day-dow"></span><span class="day-num"></span>';
        b.querySelector('.day-dow').textContent = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        b.querySelector('.day-num').textContent = String(d.getDate());
        b.addEventListener('click', function () {
          state.dayOff = off; state.slot = null; renderBooking();
        });
        dayGrid.appendChild(b);
      })(i);
    }

    // time slots
    slotWrap.innerHTML = '';
    var times = slotTimes(state.svc, selectedDate());
    if (times.length) {
      var grid = document.createElement('div');
      grid.className = 'slot-grid';
      times.forEach(function (t, idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot-cell' + (state.slot === t ? ' selected' : '');
        b.style.setProperty('--i', idx);
        b.setAttribute('aria-pressed', String(state.slot === t));
        b.textContent = t;
        b.addEventListener('click', function () {
          state.slot = t; renderBooking();
        });
        grid.appendChild(b);
      });
      slotWrap.appendChild(grid);
    } else {
      var msg = document.createElement('p');
      msg.className = 'no-slots';
      msg.textContent = 'No ' + svcName() + ' times this day — TeamSTRONG runs Tue & Thu 6:00 PM and Sat 9:00 AM. Pick another day.';
      slotWrap.appendChild(msg);
    }

    $('#bookSummary').textContent = bookSummary();
  }

  function showError(msg) {
    bkError.textContent = msg;
    bkError.hidden = false;
    bkError.classList.remove('shake');
    void bkError.offsetWidth; // restart the shake animation
    bkError.classList.add('shake');
  }

  $('#bkConfirm').addEventListener('click', function () {
    var name = $('#bkName').value.trim();
    var email = $('#bkEmail').value.trim();
    if (!state.slot) return showError('Pick a time slot first.');
    if (!name || !email) return showError('Name and email are required.');
    bkError.hidden = true;
    state.booked = true;
    $('#bookGrid').hidden = true;
    $('#confirmTitle').textContent = "You're on the books, " + name + '.';
    $('#confirmBody').textContent = bookSummary() + '. A confirmation is headed to ' + email + '. Be well. Stay committed. Train for life.';
    var done = $('#bookDone');
    done.hidden = false;
    done.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  });

  $('#bkAnother').addEventListener('click', function () {
    state.booked = false; state.slot = null;
    $('#bookDone').hidden = true;
    $('#bookGrid').hidden = false;
    renderBooking();
  });

  /* ============ newsletter ============ */

  $('#newsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#newsEmail').value.trim();
    if (!email) return;
    $('#newsForm').hidden = true;
    $('#newsDone').hidden = false;
  });

  /* ============ init ============ */

  renderQuiz();
  renderCalendar();
  renderEvents();
  renderBooking();
})();
