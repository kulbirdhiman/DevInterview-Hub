import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  firstName: String,
  lastName: String,
  imageUrl: String,
  username: String,
  bio: {
    type: String,
    default: '',
  },

  skills: {
    type: [String],
    default: [],
  },

  github: {
    type: String,
    default: '',
  },

  linkedin: {
    type: String,
    default: '',
  },

  portfolio: {
    type: String,
    default: '',
  },
  // Add your own custom fields here
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
});

export const User = mongoose.model('User', userSchema);