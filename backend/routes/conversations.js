import express from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { publicUser } from './auth.js';
import { asyncRoute, httpError } from '../utils/http.js';

const router = express.Router();
const ALLOWED_REACTIONS = new Set(['❤️', '👍', '😂', '😮', '🎉']);
const IMAGE_DATA = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i;

const isId = (value) => mongoose.isValidObjectId(value);
const userId = (req) => String(req.session.userId);
const isParticipant = (conversation, id) => conversation.participants.some((participant) => String(participant._id || participant) === id);

const mapMessage = (message) => ({
  id: String(message._id),
  conversationId: String(message.conversation),
  sender: message.sender?._id ? publicUser(message.sender) : { id: String(message.sender) },
  text: message.text,
  imageUrl: message.imageUrl,
  reactions: (message.reactions || []).map((reaction) => ({ userId: String(reaction.user?._id || reaction.user), emoji: reaction.emoji })),
  readBy: (message.readBy || []).map(String),
  editedAt: message.editedAt,
  deletedAt: message.deletedAt,
  createdAt: message.createdAt
});

const requireConversation = async (req) => {
  if (!isId(req.params.conversationId)) throw httpError(400, 'Invalid conversation.');
  const conversation = await Conversation.findById(req.params.conversationId);
  if (!conversation || !isParticipant(conversation, userId(req))) throw httpError(404, 'Conversation not found.');
  return conversation;
};

const emitToConversationUsers = (req, conversation, event, payload) => {
  for (const participant of conversation.participants) req.io.to(`user:${participant}`).emit(event, payload);
};

router.get('/', asyncRoute(async (req, res) => {
  const me = userId(req);
  const conversations = await Conversation.find({ participants: me })
    .populate('participants', 'username displayName avatar bio lastSeen createdAt')
    .sort({ updatedAt: -1 })
    .lean();

  const result = await Promise.all(conversations.map(async (conversation) => {
    const partner = conversation.participants.find((participant) => String(participant._id) !== me);
    const unreadCount = await Message.countDocuments({ conversation: conversation._id, sender: { $ne: me }, readBy: { $ne: me }, deletedAt: null });
    return {
      id: String(conversation._id),
      partner: publicUser(partner),
      lastMessage: conversation.lastMessage || null,
      unreadCount,
      updatedAt: conversation.updatedAt
    };
  }));
  return res.json(result);
}));

router.post('/', asyncRoute(async (req, res) => {
  const me = userId(req);
  const partnerId = String(req.body.userId || '');
  if (!isId(partnerId) || partnerId === me) return res.status(400).json({ error: 'Choose a valid person.' });
  const partner = await User.findById(partnerId).lean();
  if (!partner) return res.status(404).json({ error: 'User not found.' });
  const pairKey = [me, partnerId].sort().join(':');
  const conversation = await Conversation.findOneAndUpdate(
    { pairKey },
    { $setOnInsert: { participants: [me, partnerId], pairKey } },
    { new: true, upsert: true, runValidators: true }
  );
  return res.status(201).json({ id: String(conversation._id), partner: publicUser(partner), lastMessage: conversation.lastMessage, unreadCount: 0, updatedAt: conversation.updatedAt });
}));

router.get('/:conversationId/messages', asyncRoute(async (req, res) => {
  const conversation = await requireConversation(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 80);
  const filter = { conversation: conversation._id };
  if (req.query.before) {
    const before = new Date(String(req.query.before));
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  }
  const messages = await Message.find(filter).populate('sender', 'username displayName avatar bio lastSeen createdAt').sort({ createdAt: -1 }).limit(limit + 1).lean();
  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();
  return res.json({ messages: messages.reverse().map(mapMessage), hasMore });
}));

router.post('/:conversationId/messages', asyncRoute(async (req, res) => {
  const conversation = await requireConversation(req);
  const text = String(req.body.text || '').trim();
  const imageUrl = String(req.body.imageUrl || '');
  if (!text && !imageUrl) return res.status(400).json({ error: 'Write a message or add an image.' });
  if (text.length > 4000) return res.status(400).json({ error: 'Message is too long.' });
  if (imageUrl && (imageUrl.length > 480_000 || !IMAGE_DATA.test(imageUrl))) return res.status(400).json({ error: 'Image must be under 350 KB.' });

  const message = await Message.create({ conversation: conversation._id, sender: userId(req), text, imageUrl, readBy: [userId(req)] });
  conversation.lastMessage = { text: text || 'Shared an image', sender: userId(req), kind: imageUrl ? 'image' : 'text', at: message.createdAt };
  await conversation.save();
  const populated = await message.populate('sender', 'username displayName avatar bio lastSeen createdAt');
  const payload = mapMessage(populated);
  emitToConversationUsers(req, conversation, 'message:new', payload);
  return res.status(201).json(payload);
}));

router.post('/:conversationId/read', asyncRoute(async (req, res) => {
  const conversation = await requireConversation(req);
  const me = userId(req);
  await Message.updateMany({ conversation: conversation._id, sender: { $ne: me }, readBy: { $ne: me } }, { $addToSet: { readBy: me } });
  emitToConversationUsers(req, conversation, 'conversation:read', { conversationId: String(conversation._id), userId: me, at: new Date().toISOString() });
  return res.status(204).end();
}));

router.patch('/:conversationId/messages/:messageId', asyncRoute(async (req, res) => {
  const conversation = await requireConversation(req);
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 4000) return res.status(400).json({ error: 'Edited message must be 1–4,000 characters.' });
  const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id, sender: userId(req), deletedAt: null });
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (Date.now() - message.createdAt.getTime() > 15 * 60 * 1000) return res.status(403).json({ error: 'Messages can be edited for 15 minutes.' });
  message.text = text;
  message.editedAt = new Date();
  await message.save();
  const populated = await message.populate('sender', 'username displayName avatar bio lastSeen createdAt');
  const payload = mapMessage(populated);
  emitToConversationUsers(req, conversation, 'message:updated', payload);
  return res.json(payload);
}));

router.delete('/:conversationId/messages/:messageId', asyncRoute(async (req, res) => {
  const conversation = await requireConversation(req);
  const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id, sender: userId(req), deletedAt: null });
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  message.text = '';
  message.imageUrl = '';
  message.deletedAt = new Date();
  await message.save();
  const payload = mapMessage(message);
  emitToConversationUsers(req, conversation, 'message:updated', payload);
  return res.json(payload);
}));

router.post('/:conversationId/messages/:messageId/reaction', asyncRoute(async (req, res) => {
  const conversation = await requireConversation(req);
  const emoji = String(req.body.emoji || '');
  if (!ALLOWED_REACTIONS.has(emoji)) return res.status(400).json({ error: 'Unsupported reaction.' });
  const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id, deletedAt: null });
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  const me = userId(req);
  const existing = message.reactions.findIndex((reaction) => String(reaction.user) === me && reaction.emoji === emoji);
  if (existing >= 0) message.reactions.splice(existing, 1);
  else {
    message.reactions = message.reactions.filter((reaction) => String(reaction.user) !== me);
    message.reactions.push({ user: me, emoji });
  }
  await message.save();
  const populated = await message.populate('sender', 'username displayName avatar bio lastSeen createdAt');
  const payload = mapMessage(populated);
  emitToConversationUsers(req, conversation, 'message:updated', payload);
  return res.json(payload);
}));

export default router;
