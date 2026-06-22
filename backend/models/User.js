import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 24 },
  displayName: { type: String, required: true, trim: true, maxlength: 48 },
  passwordHash: { type: String, required: true, select: false },
  avatar: { type: String, default: '', maxlength: 500_000 },
  bio: { type: String, default: 'Available to chat', trim: true, maxlength: 120 },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ displayName: 1 });

export default mongoose.model('User', userSchema);
