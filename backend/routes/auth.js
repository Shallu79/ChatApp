import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { asyncRoute } from '../utils/http.js';

const router = express.Router();
const USERNAME = /^[a-z0-9_]{3,24}$/;
const IMAGE_DATA = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i;
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 35,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes.' }
});

export const publicUser = (user) => ({
  id: String(user._id),
  username: user.username,
  displayName: user.displayName,
  avatar: user.avatar || '',
  bio: user.bio || 'Available to chat',
  lastSeen: user.lastSeen,
  createdAt: user.createdAt
});

const setSession = async (req, user) => {
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.userId = String(user._id);
  await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
};

const validAvatar = (value) => !value || (value.length <= 15 * 1024 * 1024 && IMAGE_DATA.test(value));

router.get('/me', asyncRoute(async (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not signed in.' });
  const user = await User.findById(req.session.userId).lean();
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Account no longer exists.' });
  }
  return res.json(publicUser(user));
}));

router.get('/username-check', authLimit, asyncRoute(async (req, res) => {
  const username = String(req.query.username || '').trim().toLowerCase();
  if (!USERNAME.test(username)) return res.status(400).json({ error: 'Use 3–24 letters, numbers, or underscores.' });
  const exists = await User.exists({ username });
  return res.json({
    available: !exists,
    suggestion: exists ? `${username.slice(0, 15)}_${Math.floor(100 + Math.random() * 900)}` : username
  });
}));

router.post('/register', authLimit, asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const displayName = String(req.body.displayName || username).trim();
  const password = String(req.body.password || '');
  const avatar = String(req.body.avatar || '');

  if (!USERNAME.test(username)) return res.status(400).json({ error: 'Username must use 3–24 letters, numbers, or underscores.' });
  if (displayName.length < 2 || displayName.length > 48) return res.status(400).json({ error: 'Display name must be 2–48 characters.' });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8–72 characters.' });
  if (!validAvatar(avatar)) return res.status(400).json({ error: 'Avatar must be a PNG, JPEG, WebP, or GIF under 10 MB.' });

  let user;
  try {
    user = await User.create({ username, displayName, avatar, passwordHash: await bcrypt.hash(password, 12) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That username is already taken.' });
    throw error;
  }
  await setSession(req, user);
  return res.status(201).json(publicUser(user));
}));

router.post('/login', authLimit, asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ username }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  await setSession(req, user);
  return res.json(publicUser(user));
}));

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.status(204).end();
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('mango.sid');
    return res.status(204).end();
  });
});

export default router;
