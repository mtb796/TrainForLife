/* Footer mailing-list signup — present on every page.
   Posts to /api/lead so the address lands in the CRM. */
(function () {
  'use strict';
  var form = document.getElementById('newsForm');
  if (!form) return;
  var err = document.getElementById('newsError');
  var done = document.getElementById('newsDone');
  var input = document.getElementById('newsEmail');
  var btn = form.querySelector('button[type=submit]');

  function fail(msg) {
    if (err) { err.textContent = msg; err.hidden = false; }
    if (btn) { btn.disabled = false; }
    input.focus();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Enter a valid email address.');
    if (err) err.hidden = true;
    if (btn) btn.disabled = true;

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'newsletter', email: email })
    }).then(function (r) {
      if (!r.ok) throw new Error('rejected');
      form.hidden = true;
      if (done) done.hidden = false;
    }).catch(function () {
      // Backend not reachable yet — don't pretend it worked.
      fail('Sorry, we could not sign you up just now. Email hello@thestrongacademy.com and we’ll add you.');
    });
  });
})();
