const mongoose = require('mongoose');

// An AI-drafted outreach email. Nothing is sent until the owner approves it.
const outreachDraftSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contact: {
    name:        { type: String, required: true, trim: true },
    title:       String,
    company:     String,
    linkedinUrl: String
  },
  toEmail:     { type: String, lowercase: true, trim: true },
  emailCandidates: { type: Array, default: [] },
  goal:        { type: String, required: true },
  subject:     { type: String, required: true },
  body:        { type: String, required: true },
  personalizationNotes: { type: [String], default: [] },
  status:      { type: String, enum: ['pending', 'approved', 'sent', 'rejected'], default: 'pending', index: true },
  sentAt:      Date,
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('OutreachDraft', outreachDraftSchema);
