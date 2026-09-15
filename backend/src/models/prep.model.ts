import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    kind: {
      type: String,
      enum: ['coding', 'system-design', 'behavioural', 'concept'],
      default: 'concept',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    // What a strong answer covers. Shown after the user attempts the question.
    lookFor: { type: [String], default: [] },

    answer: { type: String, default: '' },
    answeredAt: Date,

    // Populated by the AI review pass.
    score: { type: Number, min: 0, max: 10 },
    feedback: { type: String, default: '' },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
  },
  { _id: true }
);

const prepSessionSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, index: true },

  targetRole: { type: String, required: true },
  stack: { type: [String], default: [] },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },

  // Optional resume the questions were tailored from.
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },

  questions: { type: [questionSchema], default: [] },

  status: {
    type: String,
    enum: ['ready', 'in-progress', 'completed'],
    default: 'ready',
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

prepSessionSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export const PrepSession = mongoose.model('PrepSession', prepSessionSchema);
