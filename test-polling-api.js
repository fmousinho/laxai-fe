#!/usr/bin/env node

// Test script to check the backend polling API
// Run with: node test-polling-api.js

const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

const BACKEND_URL = process.env.BACKEND_API_URL;
const TASK_ID = process.argv[2] || 'c6c284b5-abf8-494d-87a7-b43bd3cdcde5'; // Use the task ID from the error
const TENANT_ID = process.argv[3] || 'your-tenant-id'; // You'll need to provide this

async function testPollingAPI() {
  if (!BACKEND_URL) {
    console.error('BACKEND_API_URL environment variable is not set');
    process.exit(1);
  }

  console.log(`Testing backend polling API...`);
  console.log(`BACKEND_URL: ${BACKEND_URL}`);
  console.log(`TASK_ID: ${TASK_ID}`);
  console.log(`TENANT_ID: ${TENANT_ID}`);
  console.log('');

  try {
    // Authenticate with Google Cloud
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL);

    // Test the polling endpoint
    const apiUrl = `${BACKEND_URL}/api/v1/track/${TASK_ID}/progress`;
    console.log(`Calling: ${apiUrl}?tenant_id=${TENANT_ID}`);

    const response = await client.request({
      url: apiUrl,
      method: 'GET',
      params: { tenant_id: TENANT_ID }
    });

    console.log(`✅ Success! Status: ${response.status}`);
    console.log('Response data:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    }
    console.error('Full error:', error);
  }
}

testPollingAPI();