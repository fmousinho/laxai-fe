const { GoogleAuth } = require('google-auth-library');

async function testHeaders() {
  try {
    const auth = new GoogleAuth();
    const baseUrl = 'https://laxai-api-517529966392.us-central1.run.app';
    const client = await auth.getIdTokenClient(baseUrl);
    const headers = await client.getRequestHeaders();
    
    console.log('=== Testing with various header formats ===');
    
    const headerVariations = [
      { name: 'Standard Bearer', headers: headers },
      { name: 'X-Goog-IAM-Authorization-Token', headers: { 'X-Goog-IAM-Authorization-Token': headers.authorization.split(' ')[1] } },
      { name: 'X-Goog-IAM-Authority-Selector', headers: { 
        ...headers,
        'X-Goog-IAM-Authority-Selector': 'nodejs-vercel-service-account@laxai-466119.iam.gserviceaccount.com'
      }},
      { name: 'With User-Agent', headers: { 
        ...headers,
        'User-Agent': 'nodejs-client'
      }},
    ];
    
    for (const variation of headerVariations) {
      console.log(`\n--- Testing: ${variation.name} ---`);
      
      try {
        const response = await fetch(`${baseUrl}/api/v1/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...variation.headers
          },
          body: JSON.stringify({
            video_url: 'https://example.com/test.mp4',
            tenant_id: 'debug-test'
          })
        });
        
        console.log(`Status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log(`Error: ${errorText}`);
        } else {
          console.log('SUCCESS!');
          const responseData = await response.text();
          console.log(`Response: ${responseData}`);
        }
        
      } catch (error) {
        console.log(`Network error: ${error.message}`);
      }
    }
    
    // Also test if the issue is with the request body
    console.log('\n--- Testing minimal request ---');
    try {
      const response = await fetch(`${baseUrl}/api/v1/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({})
      });
      
      console.log(`Minimal request status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Minimal request error: ${errorText}`);
      }
    } catch (error) {
      console.log(`Minimal request network error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testHeaders();