import mongoose from 'mongoose';

const MAX_CONTENT_LENGTH = 5000; // 5KB max content length per item

const linkSchema = new mongoose.Schema({
  syncKey: {
    type: String,
    required: [true, 'Sync key is required to associate data'],
    index: true
  },
  content: {
    type: String,
    required: [true, 'Content (URL or text snippet) is required'],
    trim: true,
    maxlength: [MAX_CONTENT_LENGTH, `Content must be under ${MAX_CONTENT_LENGTH} characters`]
  },
  sourceDevice: {
    type: String,
    required: true,
    enum: {
      values: ['desktop', 'mobile'],
      message: 'Source device must be either desktop or mobile'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create text index on the content field for full-text filtering
linkSchema.index({ content: 'text' });

// Compound index for common query patterns (history by syncKey sorted by date)
linkSchema.index({ syncKey: 1, createdAt: -1 });

const Link = mongoose.model('Link', linkSchema);
export default Link;
