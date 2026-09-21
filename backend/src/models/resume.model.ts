import mongoose from 'mongoose';

const experienceSchema = new mongoose.Schema(
  {
    company: String,
    role: String,
    start: String,
    end: String,
    bullets: { type: [String], default: [] },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    tech: { type: [String], default: [] },
    link: String,
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    school: String,
    degree: String,
    year: String,
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, index: true },

  title: { type: String, default: 'Untitled resume' },
  targetRole: { type: String, default: '' },

  // What the user typed in. Kept so a resume can be regenerated later.
  rawInput: { type: String, default: '' },

  // Generated, then freely editable by the user.
  fullName: { type: String, default: '' },
  headline: { type: String, default: '' },
  summary: { type: String, default: '' },
  skills: { type: [String], default: [] },
  experience: { type: [experienceSchema], default: [] },
  projects: { type: [projectSchema], default: [] },
  education: { type: [educationSchema], default: [] },

  generatedByAI: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

resumeSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export const Resume = mongoose.model('Resume', resumeSchema);
