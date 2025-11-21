const Job = require('./models/Job');
const Record = require('./models/Record');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const readline = require('readline');

class JobQueue {
  constructor() {
    this.isProcessing = false;
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }

  async enqueueJob(fileId, fileName) {
    const jobId = uuidv4();
    
    const job = new Job({
      jobId,
      fileId,
      fileName,
      status: 'pending'
    });
    
    await job.save();
    
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return job;
  }

  async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (true) {
      const job = await Job.findOne({ status: 'pending' }).sort({ createdAt: 1 });
      
      if (!job) {
        this.isProcessing = false;
        break;
      }
      
      await this.processJob(job);
    }
  }

  async processJob(job) {
    try {
      console.log(`Processing job ${job.jobId} for file ${job.fileName}`);
      
      job.status = 'processing';
      job.startedAt = new Date();
      await job.save();
      
      const fileContent = await this.downloadFromS3(job.fileName);
      
      const result = await this.processFileContent(fileContent, job.fileId);
      
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      await job.save();
      
      console.log(`Job ${job.jobId} completed successfully`);
      
    } catch (error) {
      console.error(`Job ${job.jobId} failed:`, error);
      
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error.message;
      await job.save();
    }
  }

async downloadFromS3(fileName) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName
  });
  
  const response = await this.s3Client.send(command);
  return response.Body; 
}

 async processFileContent(fileStream, fileId) {
  let totalLines = 0;
  let successfulInserts = 0;
  let failedLines = 0;
  const errors = [];
  const errorCategories = {
    missingFields: 0,
    invalidEmail: 0,
    invalidAge: 0,
    malformedLine: 0,
    other: 0
  };
  
  const batch = [];
  const BATCH_SIZE = 100;
  
  let isFirstLine = true;

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }

    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine === ',,,') {
      continue;
    }

    totalLines++;

    try {
      const fields = this.parseCSVLine(trimmedLine);
      
      if (fields.length < 2) {
        errorCategories.malformedLine++;
        throw new Error('Insufficient fields (need at least name and email)');
      }
      
      const [name, email, age, department] = fields;
      
      if (!name || name.trim() === '') {
        errorCategories.missingFields++;
        throw new Error('Name is required');
      }
      
      if (!email || email.trim() === '') {
        errorCategories.missingFields++;
        throw new Error('Email is required');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errorCategories.invalidEmail++;
        throw new Error(`Invalid email format: ${email}`);
      }
      
      let parsedAge = null;
      if (age && age.trim() !== '') {
        parsedAge = parseInt(age.trim());
        if (isNaN(parsedAge)) {
          errorCategories.invalidAge++;
          throw new Error(`Invalid age format: "${age}" is not a number`);
        }
        if (parsedAge < 0 || parsedAge > 150) {
          errorCategories.invalidAge++;
          throw new Error(`Invalid age value: ${parsedAge} (must be 0-150)`);
        }
      }
      
      const record = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        age: parsedAge,
        department: department ? department.trim() : null,
        uploadedFileId: fileId,
        processedAt: new Date()
      };
      
      batch.push(record);
      
      if (batch.length >= BATCH_SIZE) {
        await Record.insertMany(batch);
        successfulInserts += batch.length;
        console.log(`✓ Inserted batch: ${successfulInserts} records processed`);
        batch.length = 0;
      }
      
    } catch (error) {
      failedLines++;
      
      if (!errorCategories.missingFields && 
          !errorCategories.invalidEmail && 
          !errorCategories.invalidAge && 
          !errorCategories.malformedLine) {
        errorCategories.other++;
      }
      
      if (errors.length < 50) {
        errors.push({
          line: totalLines + 1, 
          error: error.message,
          data: trimmedLine.substring(0, 100) 
        });
      }
      
      console.log(`✗ Line ${totalLines + 1} failed: ${error.message}`);
    }
  }
  
  if (batch.length > 0) {
    await Record.insertMany(batch);
    successfulInserts += batch.length;
    console.log(`✓ Final batch inserted: ${successfulInserts} total records`);
  }
  
  const successRate = totalLines > 0 
    ? Math.round((successfulInserts / totalLines) * 100) 
    : 0;
  
  console.log(`\n📊 Processing Summary:`);
  console.log(`   Total lines: ${totalLines}`);
  console.log(`   Successful: ${successfulInserts} (${successRate}%)`);
  console.log(`   Failed: ${failedLines}`);
  console.log(`   Error breakdown:`, errorCategories);
  
  return {
    totalLines,
    successfulInserts,
    failedLines,
    successRate,
    errorCategories,
    errors: errors.slice(0, 10), 
    summary: `Processed ${successfulInserts}/${totalLines} records successfully (${successRate}% success rate)`
  };
}

parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  fields.push(currentField);
  
  return fields;
}

  async getJobStatus(jobId) {
    return await Job.findOne({ jobId });
  }
}

const jobQueue = new JobQueue();

module.exports = jobQueue;