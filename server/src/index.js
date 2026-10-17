require('./config');

const mongoose = require('mongoose');
const app = require('./app');
const { getRequiredEnv } = require('./config');

async function start() {
  await mongoose.connect(getRequiredEnv('MONGO_URI'));
  const port = 3001;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`PopPay API listening on port ${port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`PopPay API could not start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { start };
