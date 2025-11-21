const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true
  },
  fileId: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  progress: {
    type: Number,
    default: 0
  },
  result: {
    totalLines: Number,
    successfulInserts: Number,
    failedLines: Number,
    successRate: Number,
    errorCategories: Object,
    errors: [Object],
    performance: Object,
    summary: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  startedAt: Date,
  completedAt: Date,
  error: String,
  
  restartCount: {
    type: Number,
    default: 0
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  recoveredAt: Date
});

module.exports = mongoose.model('Job', jobSchema);