require('./config');

const express = require('express');
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
app.use(express.json({ limit: '32kb' }));
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1', apiRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : error.message,
  });
});

module.exports = app;
