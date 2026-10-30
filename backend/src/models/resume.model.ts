import mongoose from 'mongoose';

const experienceSchema = new mongoose.Schema(
  {
    id: String,
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
    id: String,
    name: String,
    description: String,
    tech: { type: [String], default: [] },
    link: String,
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    id: String,
    school: String,
    degree: String,
    year: String,
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, index: true },

  creationOperation: String,
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

  contact: { type: mongoose.Schema.Types.Mixed, default: () => ({ email: '', phone: '', location: '', website: '', linkedin: '', github: '' }) },
  certifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
  achievements: { type: [mongoose.Schema.Types.Mixed], default: [] },
  customSections: { type: [mongoose.Schema.Types.Mixed], default: [] },
  sectionOrder: { type: [String], default: () => ['summary', 'experience', 'projects', 'skills', 'education', 'certifications', 'achievements'] },
  presentation: { type: mongoose.Schema.Types.Mixed, default: () => ({ template: 'ats', font: 'sans', fontSize: 'medium', spacing: 'comfortable', color: 'emerald' }) },
  revision: { type: Number, default: 0 },
  versionCount: { type: Number, default: 0 },
  versions: { type: [new mongoose.Schema({
    label: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    sourceRevision: { type: Number, required: true },
    schemaVersion: { type: Number, default: 1 },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  })], default: [], select: false },
  generatedByAI: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

resumeSchema.pre('save', function () {
  this.updatedAt = new Date();
});

resumeSchema.index({ clerkId: 1, creationOperation: 1 }, { unique: true, partialFilterExpression: { creationOperation: { $type: 'string' } } });

export const Resume = mongoose.model('Resume', resumeSchema);
