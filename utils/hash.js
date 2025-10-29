const crypto = require('crypto');

function sha256(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = { sha256 };
