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
  displayName: { type: String, default: '' },
  education: { type: String, default: '' },
  experienceLevel: { type: String, enum: ['', 'student', 'fresher', 'early-career', 'experienced'], default: '' },
  targetRole: { type: String, default: '' },
  targetIndustry: { type: String, default: '' },
  careerGoals: { type: String, default: '' },
  interviewLanguage: { type: String, enum: ['English', 'Hindi'], default: 'English' },
  salaryMin: { type: Number, default: null },
  salaryMax: { type: Number, default: null },
  salaryCurrency: { type: String, enum: ['INR', 'USD', 'EUR', 'GBP'], default: 'INR' },
  onboardingCompletedAt: { type: Date, default: null },
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
