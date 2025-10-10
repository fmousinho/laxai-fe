import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth, JWT } from 'google-auth-library';
import { getTenantId } from '@/lib/gcs-tenant';
import * as fs from 'fs';

const BACKEND_URL = process.env.BACKEND_API_URL;

// Module-level cache for in-flight POST requests to prevent duplicate task creation
// Maps: `${tenantId}:${videoFilename}` -> Promise<task_id>
const pendingTaskCreationRequests = new Map<string, Promise<string>>();

if (!BACKEND_URL) {
  console.error('BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.');
}

export async function POST(req: NextRequest) {
  try {
    if (!BACKEND_URL) {
      return NextResponse.json({
        error: 'Backend API URL not configured',
        message: 'BACKEND_API_URL environment variable is not set. Please add it to your .env.local file.'
      }, { status: 500 });
    }

    console.log('Track API called with method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    let body = {};
    try {
      const text = await req.text();
      console.log('Request body text:', text);
      if (text) {
        body = JSON.parse(text);
      }
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    console.log('Parsed body:', body);

    const videoFilename = (body as { video_filename?: string }).video_filename;
    
    if (!videoFilename) {
      return NextResponse.json({ error: 'video_filename is required' }, { status: 400 });
    }

    // Create a unique key for this request
    const requestKey = `${tenantId}:${videoFilename}`;

    // Check if there's already an in-flight request for this tenant + video
    const existingRequest = pendingTaskCreationRequests.get(requestKey);
    if (existingRequest) {
      console.log('🔄 DEDUPLICATION: Reusing in-flight task creation request for:', requestKey);
      try {
        const taskId = await existingRequest;
        return NextResponse.json({
          task_id: taskId,
          status: 'not_started',
          message: 'Reusing in-flight task creation',
          reused: true
        });
      } catch (error) {
        // If the in-flight request failed, continue to create a new one
        console.warn('In-flight request failed, creating new one:', error);
        pendingTaskCreationRequests.delete(requestKey);
      }
    }

    // Create a new promise for this task creation
    const taskCreationPromise = (async (): Promise<string> => {
      try {
        // Authenticate with Google Cloud using JWT constructor instead of deprecated fromJSON
        let client;
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          try {
            const keyFile = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
            client = new JWT({
              email: keyFile.client_email,
              key: keyFile.private_key,
              scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
          } catch (error) {
            console.error('Failed to create JWT client from service account key:', error);
            throw new Error('Authentication failed');
          }
        } else {
          // Fallback to GoogleAuth for other credential types
          const auth = new GoogleAuth();
          client = await auth.getIdTokenClient(BACKEND_URL!);
        }

        // IDEMPOTENCY CHECK: Check if there's already an active task for this tenant + video
        // This prevents creating duplicate tasks when backend is slower to respond
        console.log('🔍 Checking for existing active tasks for:', { tenantId, videoFilename });
        try {
          const existingTasksResponse = await client.request({
            url: `${BACKEND_URL}/api/v1/track/`,  // Note: trailing slash
            method: 'GET',
            params: {
              tenant_id: tenantId,
              limit: '50'
            }
          });

          const tasks = (existingTasksResponse.data as { tasks?: Array<{ 
            task_id: string; 
            status: string; 
            video_filename?: string;
            tracking_params?: { video_filename?: string };
          }> }).tasks || [];

          // Look for existing task with same video_filename and active status
          const existingTask = tasks.find((task: any) => {
            const taskVideoFilename = task.video_filename || task.tracking_params?.video_filename;
            const isActive = ['not_started', 'running'].includes(task.status);
            return taskVideoFilename === videoFilename && isActive;
          });

          if (existingTask) {
            console.log('✅ Found existing active task, returning it:', existingTask.task_id);
            return existingTask.task_id;
          }

          console.log('✨ No existing active task found, creating new one');
        } catch (checkError) {
          // If check fails, log but continue to create task
          console.warn('Failed to check for existing tasks, proceeding with creation:', checkError);
        }

        // Make request to backend API to create new task
        const requestData = {
          ...body,
          tenant_id: tenantId
        };
        console.log('Sending request data:', requestData);

        const response = await client.request({
          url: `${BACKEND_URL}/api/v1/track`,
          method: 'POST',
          data: requestData
        });
        console.log('🎉 New task created:', response.data);
        
        const taskData = response.data as { task_id: string };
        return taskData.task_id;
      } finally {
        // Remove from cache after completion (success or failure)
        pendingTaskCreationRequests.delete(requestKey);
      }
    })();

    // Store the promise in the cache BEFORE awaiting it
    pendingTaskCreationRequests.set(requestKey, taskCreationPromise);

    try {
      const taskId = await taskCreationPromise;
      return NextResponse.json({
        task_id: taskId,
        status: 'not_started',
        message: 'Tracking job queued successfully'
      });
    } catch (error) {
      console.error('Error creating tracking job:', error);
      return NextResponse.json({ 
        error: 'Failed to create tracking job',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in track API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant_id' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '50';

    // Authenticate with Google Cloud using JWT constructor instead of deprecated fromJSON
    let client;
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const keyFile = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
        client = new JWT({
          email: keyFile.client_email,
          key: keyFile.private_key,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
      } catch (error) {
        console.error('Failed to create JWT client from service account key:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
      }
    } else {
      // Fallback to GoogleAuth for other credential types
      const auth = new GoogleAuth();
      client = await auth.getIdTokenClient(BACKEND_URL!);
    }

    // Make request to backend API
    const response = await client.request({
      url: `${BACKEND_URL}/api/v1/track`,
      method: 'GET',
      params: {
        tenant_id: tenantId,
        limit: limit
      }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error listing tracking jobs:', error);
    return NextResponse.json({ error: 'Failed to list tracking jobs' }, { status: 500 });
  }
}