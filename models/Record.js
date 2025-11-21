const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: false
  },
  department: {
    type: String,
    required: false
  },
  uploadedFileId: {
    type: String,
    required: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Record', recordSchema);