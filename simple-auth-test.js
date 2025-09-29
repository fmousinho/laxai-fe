const { GoogleAuth } = require('google-auth-library');

async function testAuthentication() {
  try {
    const auth = new GoogleAuth();
    const baseUrl = 'https://laxai-api-517529966392.us-central1.run.app';
    const client = await auth.getIdTokenClient(baseUrl);
    
    console.log('Getting auth headers...');
    const headers = await client.getRequestHeaders();
    console.log('Auth headers:', Object.keys(headers));
    
    // Test root endpoint
    console.log('\n=== Testing root endpoint ===');
    const rootResponse = await fetch(`${baseUrl}/`, {
      headers: headers
    });
    console.log('Root status:', rootResponse.status);
    
    // Test API endpoint with different approaches
    console.log('\n=== Testing API endpoint ===');
    
    // Test 1: Standard request
    const apiResponse = await fetch(`${baseUrl}/api/v1/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        video_url: 'https://example.com/test.mp4',
        tenant_id: 'debug-test'
      })
    });
    
    console.log('API status:', apiResponse.status);
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.log('API error response:', errorText);
    } else {
      const successData = await apiResponse.text();
      console.log('API success response:', successData);
    }
    
    // Test 2: GET request to see if method matters
    console.log('\n=== Testing GET on API endpoint ===');
    const getResponse = await fetch(`${baseUrl}/api/v1/track`, {
      method: 'GET',
      headers: headers
    });
    console.log('GET status:', getResponse.status);
    
    if (!getResponse.ok) {
      const getError = await getResponse.text();
      console.log('GET error response:', getError);
    }
    
    // Test 3: Test health endpoint
    console.log('\n=== Testing health endpoint ===');
    const healthResponse = await fetch(`${baseUrl}/health`, {
      headers: headers
    });
    console.log('Health status:', healthResponse.status);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAuthentication();