import express from 'express';
import User from '../models/User.js';
import { publicUser } from './auth.js';
import { asyncRoute, escapeRegex } from '../utils/http.js';

const router = express.Router();
const IMAGE_DATA = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i;

router.get('/', asyncRoute(async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 40);
  const filter = { _id: { $ne: req.session.userId } };
  if (query) {
    const search = new RegExp(escapeRegex(query), 'i');
    filter.$or = [{ username: search }, { displayName: search }];
  }
  const users = await User.find(filter).sort({ displayName: 1 }).limit(60).lean();
  return res.json(users.map(publicUser));
}));

router.patch('/me', asyncRoute(async (req, res) => {
  const displayName = String(req.body.displayName || '').trim();
  const bio = String(req.body.bio || '').trim();
  const avatar = String(req.body.avatar || '');
  if (displayName.length < 2 || displayName.length > 48) return res.status(400).json({ error: 'Display name must be 2–48 characters.' });
  if (bio.length > 120) return res.status(400).json({ error: 'Bio can contain at most 120 characters.' });
  if (avatar && (avatar.length > 480_000 || !IMAGE_DATA.test(avatar))) {
    return res.status(400).json({ error: 'Avatar must be a PNG, JPEG, WebP, or GIF under 350 KB.' });
  }
  const user = await User.findByIdAndUpdate(req.session.userId, { displayName, bio, avatar }, { new: true, runValidators: true });
  return res.json(publicUser(user));
}));

export default router;
