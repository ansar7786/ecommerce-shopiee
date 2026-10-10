const http = require('http');
const app = require('./app');
const { PORT } = require('./config/env');
const connectDB = require('./config/db');
const { startSweeper } = require('./jobs/sweeper');
const { initSocket } = require('./sockets');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const startServer = async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    initSocket(server);
    startSweeper();
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
