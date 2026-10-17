const { verifyAccessToken } = require('../services/tokenService');

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const claims = verifyAccessToken(match[1]);
    if (claims.type !== 'merchant' || !claims.sub) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.merchantId = claims.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;
