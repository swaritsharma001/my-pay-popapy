require('./config');

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes');

const app = express();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many authentication requests. Try again later.' },
});

app.disable('x-powered-by');
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (!origin) return next();
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (
    !['http:', 'https:'].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin !== origin ||
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.host !== req.get('host')
  ) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.vary('Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(express.json({ limit: '32kb' }));
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1', apiRoutes);
app.get('/checkout.js', (req, res) => {
  res.type('application/javascript').sendFile(
    path.resolve(__dirname, '../../sdk/checkout.js'),
  );
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : error.message,
  });
});

module.exports = app;
