import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';

export function getStorageClient(): Storage {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
      return new Storage({ credentials });
    } catch (error) {
      console.error('Failed to load credentials:', error);
      return new Storage(); // Fallback
    }
  } else {
    return new Storage(); // Fallback to default auth
  }
}