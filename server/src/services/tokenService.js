const jwt = require('jsonwebtoken');
const { getRequiredEnv } = require('../config');

const TOKEN_ISSUER = 'poppay';
const TOKEN_LIFETIME = '7d';

function createAccessToken(merchant) {
  return jwt.sign(
    { email: merchant.email, type: 'merchant' },
    getRequiredEnv('JWT_SECRET'),
    {
      algorithm: 'HS256',
      expiresIn: TOKEN_LIFETIME,
      issuer: TOKEN_ISSUER,
      subject: merchant.id,
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getRequiredEnv('JWT_SECRET'), {
    algorithms: ['HS256'],
    issuer: TOKEN_ISSUER,
  });
}

module.exports = { createAccessToken, verifyAccessToken };
