import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generates a cryptographically secure unique user sync key in the format: SETU-XXXX-XXXX
 * where X represents an uppercase alphanumeric character.
 * 
 * Uses crypto.randomBytes instead of Math.random for security.
 * 
 * @returns {string} The formatted sync key.
 */
export function generateSyncKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(8);
  const segment1 = Array.from(bytes.slice(0, 4), b => chars[b % chars.length]).join('');
  const segment2 = Array.from(bytes.slice(4, 8), b => chars[b % chars.length]).join('');
  return `SETU-${segment1}-${segment2}`;
}

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    index: true
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  syncKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: generateSyncKey
  },
  activeOtp: {
    code: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    }
  },
  devices: [
    {
      deviceId: { type: String, required: true },
      deviceName: { type: String, default: '' },
      deviceType: { type: String, enum: ['desktop', 'mobile'] },
      lastActiveAt: { type: Date, default: Date.now }
    }
  ]
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;
