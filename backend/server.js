import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import conversationsRouter from './routes/conversations.js';
import { requireAuth } from './middleware/auth.js';
import Conversation from './models/Conversation.js';
import User from './models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = Number(process.env.PORT) || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mango-connect-pro';
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = [process.env.FRONTEND_ORIGIN, 'http://localhost:5173'].filter(Boolean);

if (isProduction && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production.');

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(Object.assign(new Error('Origin is not allowed.'), { status: 403 }));
  }
};

const sessionMiddleware = session({
  name: 'mango.sid',
  secret: process.env.SESSION_SECRET || 'local-development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, ttl: 60 * 60 * 24 * 14 }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
});

const app = express();
const server = http.createServer(app);
const socketOptions = { maxHttpBufferSize: 600_000 };
if (!isProduction || process.env.FRONTEND_ORIGIN) socketOptions.cors = corsOptions;
const io = new Server(server, socketOptions);
const onlineSockets = new Map();

if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
if (!isProduction || process.env.FRONTEND_ORIGIN) app.use(cors(corsOptions));
app.use(express.json({ limit: '600kb' }));
app.use(sessionMiddleware);
app.use(rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use((req, res, next) => { req.io = io; next(); });

app.get('/api/health', (req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting' }));
app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/conversations', requireAuth, conversationsRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

const frontendDist = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: isProduction ? '1d' : 0 }));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({ name: 'Mango Connect API', status: 'Frontend has not been built yet.' }));
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  const status = error.status || (error.type === 'entity.too.large' ? 413 : 500);
  return res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : error.message });
});

io.engine.use(sessionMiddleware);
io.use((socket, next) => socket.request.session?.userId ? next() : next(new Error('Authentication required.')));

const broadcastPresence = () => io.emit('presence:update', { onlineUserIds: [...onlineSockets.keys()] });

io.on('connection', (socket) => {
  const me = String(socket.request.session.userId);
  socket.join(`user:${me}`);
  const sockets = onlineSockets.get(me) || new Set();
  sockets.add(socket.id);
  onlineSockets.set(me, sockets);
  broadcastPresence();

  socket.on('conversation:join', async ({ conversationId } = {}) => {
    if (!mongoose.isValidObjectId(conversationId)) return;
    const allowed = await Conversation.exists({ _id: conversationId, participants: me });
    if (allowed) socket.join(`conversation:${conversationId}`);
  });

  socket.on('typing:set', async ({ conversationId, isTyping } = {}) => {
    if (!mongoose.isValidObjectId(conversationId)) return;
    const conversation = await Conversation.findOne({ _id: conversationId, participants: me }).lean();
    if (!conversation) return;
    for (const participant of conversation.participants) {
      if (String(participant) !== me) io.to(`user:${participant}`).emit('typing:update', { conversationId, userId: me, isTyping: Boolean(isTyping) });
    }
  });

  socket.on('disconnect', async () => {
    const active = onlineSockets.get(me);
    active?.delete(socket.id);
    if (!active?.size) {
      onlineSockets.delete(me);
      await User.findByIdAndUpdate(me, { lastSeen: new Date() }).catch(() => {});
    }
    broadcastPresence();
  });
});

await mongoose.connect(MONGO_URI);
server.listen(PORT, '0.0.0.0', () => console.log(`Mango Connect running on http://localhost:${PORT}`));

const shutdown = async () => {
  await mongoose.disconnect();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
