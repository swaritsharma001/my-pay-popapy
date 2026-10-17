const famapp = require('./famapp');

const parsersBySender = new Map([
  ['no-reply@famapp.in', famapp.parseFamAppEmail],
]);

function parserForSender(sender) {
  return parsersBySender.get(String(sender || '').trim().toLowerCase()) || null;
}

module.exports = { parserForSender, parsersBySender };
