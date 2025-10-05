const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function setGCSCors() {
  try {
    console.log('Setting GCS CORS configuration...');

    const storage = new Storage();
    const bucketName = process.env.GCS_BUCKET_NAME;

    if (!bucketName) {
      console.error('GCS_BUCKET_NAME environment variable not set');
      process.exit(1);
    }

    console.log('Bucket name:', bucketName);

    const bucket = storage.bucket(bucketName);

    // Read CORS configuration from file
    const corsConfig = JSON.parse(fs.readFileSync('./gcs-cors.json', 'utf8'));
    console.log('CORS config to apply:', JSON.stringify(corsConfig, null, 2));

    // Set CORS configuration
    await bucket.setCorsConfiguration(corsConfig);
    console.log('✅ CORS configuration applied successfully!');

    // Verify the configuration
    const [metadata] = await bucket.getMetadata();
    console.log('Current CORS configuration:', JSON.stringify(metadata.cors, null, 2));

  } catch (error) {
    console.error('❌ Failed to set GCS CORS configuration:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setGCSCors();