import express from 'express';
import cron from 'node-cron';

// Health check server
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'storybook-worker',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(PORT, () => {
  console.log(`🏥 Worker health server running on port ${PORT}`);
});

console.log('🚀 StoryCanvas Job Worker Starting...');

// Import job processing logic
async function loadJobProcessor() {
  try {
    const { jobManager } = await import('../lib/background-jobs/job-manager.js');
    const { jobProcessor } = await import('../lib/background-jobs/job-processor.js');
    
    console.log('✅ Job processing modules loaded successfully');
    return { jobManager, jobProcessor };
  } catch (error) {
    console.error('❌ Failed to load job processing modules:', error);
    return null;
  }
}

// Main worker function
async function processJobs() {
  const modules = await loadJobProcessor();
  if (!modules) {
    console.error('❌ Cannot process jobs - modules not loaded');
    return;
  }
  
  const { jobManager, jobProcessor } = modules;
  
  try {
    console.log('🔄 Worker: Scanning for pending jobs...');
    
    // Get pending jobs
    const pendingJobs = await jobManager.getPendingJobs({}, 10);
    
    if (pendingJobs.length === 0) {
      console.log('📭 Worker: No pending jobs found');
      return;
    }
    
    console.log(`📋 Worker: Found ${pendingJobs.length} pending jobs`);
    
    // Process up to 5 jobs simultaneously
    const jobsToProcess = pendingJobs.slice(0, 5);
    
    await Promise.allSettled(
      jobsToProcess.map(async (job) => {
        try {
          console.log(`🔄 Worker: Starting job ${job.id} (${job.type})`);
          await jobProcessor.processJobAsync(job);
          console.log(`✅ Worker: Completed job ${job.id}`);
        } catch (error) {
          console.error(`❌ Worker: Failed to process job ${job.id}:`, error);
        }
      })
    );
    
  } catch (error) {
    console.error('❌ Worker: Error during job processing:', error);
  }
}

// Start continuous job processing
console.log('⏰ Setting up job processing schedule...');

// Process jobs every 30 seconds
cron.schedule('*/30 * * * * *', processJobs);

// Initial run after 10 seconds
setTimeout(() => {
  console.log('🎬 Running initial job scan...');
  processJobs();
}, 10000);

console.log('✅ StoryCanvas Job Worker initialized successfully');
