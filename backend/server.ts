import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { registerRoutes } from './server/routes';
import { setupWebSocketServer } from './server/wsServer';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

registerRoutes(app);

const server = http.createServer(app);
setupWebSocketServer(server);

server.on('error', (err) => {
  console.error('Server network error:', err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`UNO No Mercy Backend listening on http://0.0.0.0:${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});