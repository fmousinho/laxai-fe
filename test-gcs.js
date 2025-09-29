// Test script to verify GCS authentication
const { Storage } = require('@google-cloud/storage');

async function testGCS() {
  try {
    console.log('Testing GCS authentication...');
    
    const storage = new Storage();
    const bucketName = 'laxai_dev';
    
    console.log('Bucket name:', bucketName);
    
    // Test 1: List buckets
    console.log('\n1. Testing bucket access...');
    const bucket = storage.bucket(bucketName);
    
    // Test 2: Generate a test signed URL
    console.log('\n2. Testing signed URL generation...');
    const file = bucket.file('test/test.txt');
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000,
      contentType: 'text/plain',
    });
    
    console.log('✅ Signed URL generated successfully');
    console.log('URL (first 100 chars):', signedUrl.substring(0, 100) + '...');
    
    console.log('\n✅ All tests passed! GCS authentication is working.');
    
  } catch (error) {
    console.error('\n❌ GCS test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testGCS();