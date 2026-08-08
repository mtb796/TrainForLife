/* Footer mailing-list signup — present on every page.
   Front-end only; connect to a real email provider in production. */
(function () {
  'use strict';
  var form = document.getElementById('newsForm');
  if (!form) return;
  var err = document.getElementById('newsError');
  var done = document.getElementById('newsDone');
  var input = document.getElementById('newsEmail');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      if (err) { err.textContent = 'Enter a valid email address.'; err.hidden = false; }
      input.focus();
      return;
    }
    if (err) err.hidden = true;
    form.hidden = true;
    if (done) done.hidden = false;
  });
})();
