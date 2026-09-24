import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { registerRoutes } from './server/routes';
import { setupWebSocketServer } from './server/wsServer';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());

// Register API and referee endpoints
registerRoutes(app);

async function startServer() {
  const server = http.createServer(app);

  // Initialize WebSocket subsystem
  setupWebSocketServer(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
