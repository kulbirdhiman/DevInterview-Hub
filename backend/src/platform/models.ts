import { Schema, model } from 'mongoose';

const taskSchema = new Schema({
  _id: { type: String, required: true }, owner: { type: String, required: true, index: true },
  type: { type: String, enum: ['analysis', 'interview_start', 'interview_answer', 'delete_account'], required: true },
  resourceId: { type: String, required: true }, revision: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'canceled'], default: 'pending', index: true },
  attempts: { type: Number, default: 0 }, adminRetries: { type: Number, default: 0 },
  leaseToken: String, leaseUntil: Date, errorCode: String,
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });
taskSchema.index({ status: 1, leaseUntil: 1, createdAt: 1 });
export const Task = model('Task', taskSchema);

export const UsageBucket = model('UsageBucket', new Schema({
  _id: String, owner: { type: String, required: true, index: true }, period: String,
  entries: { type: [new Schema({ key: String, metric: String, state: { type: String, enum: ['reserved', 'consumed', 'released'] }, createdAt: { type: Date, default: Date.now } }, { _id: false })], default: [] },
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
}));

export const AiUsage = model('AiUsage', new Schema({
  owner: { type: String, required: true, index: true }, operation: String, taskId: String, provider: String, model: String,
  inputTokens: Number, outputTokens: Number, costUsd: { type: Number, default: null }, success: Boolean, latencyMs: Number,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 86400000), index: { expireAfterSeconds: 0 } },
}));
export const Audit = model('Audit', new Schema({
  actor: String, action: String, resourceId: String, createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 86400000), index: { expireAfterSeconds: 0 } },
}));

export const Analysis = model('Analysis', new Schema({
  owner: { type: String, required: true, index: true }, resumeId: { type: Schema.Types.ObjectId, required: true },
  revision: { type: Number, required: true }, operationKey: { type: String, required: true }, taskId: String,
  snapshot: { type: Schema.Types.Mixed, required: true }, // removed on successful analysis
  state: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  report: Schema.Types.Mixed, errorCode: String,
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true }));
Analysis.schema.index({ owner: 1, operationKey: 1 }, { unique: true });

const turnSchema = new Schema({
  prompt: { type: String, required: true }, intent: { type: String, enum: ['topic', 'followup'], required: true },
  difficulty: String, sourceRefs: [String], expectedEvidence: [String],
  answer: String, answeredAt: Date, submissionKey: String, evaluation: Schema.Types.Mixed,
});
const interviewSchema = new Schema({
  owner: { type: String, required: true, index: true }, operationKey: { type: String, required: true },
  resumeId: { type: Schema.Types.ObjectId, required: true }, resumeRevision: Number,
  resumeSnapshot: { type: Schema.Types.Mixed, required: true },
  role: String, category: { type: String, enum: ['hr', 'technical', 'behavioral', 'project'] },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] }, language: String,
  durationMinutes: Number, maxQuestions: { type: Number, default: 6 },
  state: { type: String, enum: ['preparing', 'awaiting_answer', 'processing', 'paused', 'completed', 'failed'], default: 'preparing' },
  revision: { type: Number, default: 0 }, turns: { type: [turnSchema], default: [] }, taskId: String,
  endRequested: { type: Boolean, default: false }, activeMs: { type: Number, default: 0 }, lastActiveAt: Date,
  report: Schema.Types.Mixed, errorCode: String, completedAt: Date,
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });
interviewSchema.index({ owner: 1, operationKey: 1 }, { unique: true });
interviewSchema.index({ state: 1, updatedAt: 1 });
export const Interview = model('Interview', interviewSchema);
