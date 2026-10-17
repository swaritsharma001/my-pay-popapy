require('./config');

const mongoose = require('mongoose');
const app = require('./app');
const { getRequiredEnv } = require('./config');
const { startWorkerLoop, stopWorkerLoop } = require('./workers/workerLoop');

async function start() {
  await mongoose.connect(getRequiredEnv('MONGO_URI'));
  startWorkerLoop();
  const port = Number(process.env.PORT) || 3001;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`PopPay API listening on port ${port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      stopWorkerLoop();
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    // Never print configuration values or raw driver errors, which may contain a URI.
    console.error(`PopPay API could not start: ${error.name || 'Error'}`);
    process.exit(1);
  });
}

module.exports = { start };
