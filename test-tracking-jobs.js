// Simple test script to verify the tracking jobs API endpoint
// Run with: node test-tracking-jobs.js

const fetch = require('node-fetch');

async function testTrackingJobsAPI() {
  const baseUrl = 'http://localhost:3001'; // Adjust port if needed

  try {
    console.log('Testing tracking jobs API endpoint...');

    const response = await fetch(`${baseUrl}/api/tracking-jobs?limit=10`);

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();

    console.log('✅ API Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.jobs && Array.isArray(data.jobs)) {
      console.log(`\n📊 Found ${data.jobs.length} tracking jobs`);

      if (data.jobs.length > 0) {
        console.log('\n🔍 Sample job details:');
        const sampleJob = data.jobs[0];
        console.log(`Task ID: ${sampleJob.task_id}`);
        console.log(`Status: ${sampleJob.status}`);
        console.log('Other properties:', Object.keys(sampleJob).filter(key => key !== 'task_id' && key !== 'status'));
      }
    } else {
      console.log('⚠️  No jobs array in response');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTrackingJobsAPI();