require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_BASE = 'http://localhost:3000';

async function uploadFile(filename) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filename));
  
  const response = await axios.post(`${API_BASE}/upload`, formData, {
    headers: formData.getHeaders()
  });
  
  return response.data;
}

async function processFile(fileId, fileName) {
  const response = await axios.post(`${API_BASE}/process/${fileId}`, {
    fileName: fileName
  });
  
  return response.data;
}

async function getJobStatus(jobId) {
  const response = await axios.get(`${API_BASE}/jobs/${jobId}`);
  return response.data;
}

async function getQueueStats() {
  const response = await axios.get(`${API_BASE}/queue/stats`);
  return response.data;
}

async function simulateMultipleUsers() {
  console.log('🚀 Simulating multiple users submitting jobs...\n');
  
  // Create test files first if they don't exist
  const testFiles = [
    'small-test.csv',
    'medium-test.csv', 
    'large-test.csv'
  ];
  
  const jobs = [];
  
  // Step 1: Upload files (simulating 3 users)
  console.log('📤 Step 1: Users uploading files...');
  for (let i = 0; i < testFiles.length; i++) {
    const file = testFiles[i];
    
    if (!fs.existsSync(file)) {
      console.log(`⚠️  ${file} doesn't exist, skipping...`);
      continue;
    }
    
    console.log(`   User ${i + 1} uploading ${file}...`);
    const uploadResult = await uploadFile(file);
    console.log(`   ✓ Uploaded: ${uploadResult.fileId}`);
    
    jobs.push({
      user: `User ${i + 1}`,
      file: file,
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
      size: uploadResult.size
    });
  }
  
  console.log('\n⏱️  Step 2: All users submitting processing jobs simultaneously...\n');
  
  // Step 2: Submit all processing jobs at once (simulate concurrent requests)
  const processPromises = jobs.map(async (job) => {
    console.log(`   ${job.user} requesting processing of ${job.file}...`);
    const processResult = await processFile(job.fileId, job.fileName);
    job.jobId = processResult.jobId;
    console.log(`   ✓ ${job.user} job enqueued: ${processResult.jobId}`);
    return processResult;
  });
  
  await Promise.all(processPromises);
  
  console.log('\n📊 Step 3: Monitoring queue stats...\n');
  
  // Step 3: Monitor queue stats
  let allComplete = false;
  let iteration = 0;
  
  while (!allComplete && iteration < 100) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const stats = await getQueueStats();
    console.log(`   [${new Date().toLocaleTimeString()}] Queue: ${stats.pending} pending, ${stats.processing} processing, ${stats.completed} completed, ${stats.failed} failed`);
    
    if (stats.pending === 0 && stats.processing === 0 && stats.completed === jobs.length) {
      allComplete = true;
    }
    
    iteration++;
  }
  
  console.log('\n✅ Step 4: Final results:\n');
  
  // Step 4: Show final results
  for (const job of jobs) {
    const status = await getJobStatus(job.jobId);
    const duration = status.completedAt 
      ? Math.round((new Date(status.completedAt) - new Date(status.startedAt)) / 1000)
      : 'N/A';
    
    console.log(`   ${job.user} (${job.file}):`);
    console.log(`      Status: ${status.status}`);
    console.log(`      Duration: ${duration}s`);
    if (status.result) {
      console.log(`      Records: ${status.result.successfulInserts}/${status.result.totalLines} (${status.result.successRate}%)`);
    }
    console.log('');
  }
  
  console.log('🎉 Test complete!');
}

// Run the simulation
simulateMultipleUsers().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});