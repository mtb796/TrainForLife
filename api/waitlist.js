/* Legacy alias.
 *
 * Waitlist capture moved to /api/lead, which stores to the CRM as well as
 * emailing. A page cached before that change still posts here, so forward
 * the request rather than dropping a real signup on the floor. */
'use strict';

const lead = require('./lead');

module.exports = function handler(req, res) {
  if (req.body && typeof req.body === 'object' && !req.body.source) req.body.source = 'waitlist';
  return lead(req, res);
};
