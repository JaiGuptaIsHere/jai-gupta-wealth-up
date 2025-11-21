require('dotenv').config();
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { handleStreamingUpload } = require('./uploadHandler');
const jobQueue = require('./jobQueue');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || 
        file.mimetype === 'text/csv' ||
        file.originalname.endsWith('.txt') || 
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only text and CSV files are allowed'));
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/upload', async (req, res) => {
  try {
    const result = await handleStreamingUpload(req);


    res.status(200).json({
      message: 'File uploaded successfully',
      fileId: result.fileId,
      fileName: result.fileName,
      size: result.size
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error.message.includes('File size limit')) {
      return res.status(400).json({ 
        error: 'File too large', 
        details: 'Maximum file size is 1GB' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload file', 
      details: error.message 
    });
  }
});

app.post('/process/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const fileName = `${fileId}-*`; 
    
    
    const { fileName: providedFileName } = req.body;
    
    if (!providedFileName) {
      return res.status(400).json({ 
        error: 'fileName is required in request body',
        example: { fileName: 'uuid-filename.csv' }
      });
    }
    
    const job = await jobQueue.enqueueJob(fileId, providedFileName);
    
    res.status(202).json({
      message: 'Job enqueued successfully',
      jobId: job.jobId,
      status: job.status,
      checkStatusUrl: `/jobs/${job.jobId}`
    });
    
  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({ error: 'Failed to enqueue job', details: error.message });
  }
});

app.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await jobQueue.getJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json({
      jobId: job.jobId,
      fileId: job.fileId,
      fileName: job.fileName,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.result,
      error: job.error
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get job status', details: error.message });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});