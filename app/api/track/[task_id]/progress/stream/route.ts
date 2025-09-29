import { NextRequest, NextResponse } from 'next/server';
import { getTenantId } from '@/lib/gcs-tenant';
import { GoogleAuth } from 'google-auth-library';

const BACKEND_URL = process.env.BACKEND_API_URL;

if (!BACKEND_URL) {
  throw new Error('BACKEND_API_URL environment variable is not set');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ task_id: string }> }
) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { task_id } = await params;

    // For SSE streaming, authenticate with Google Cloud Run
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(BACKEND_URL!);

    // Get the authorization header for the progress stream endpoint
    const progressStreamUrl = `${BACKEND_URL}/api/v1/track/${task_id}/progress/stream`;
    const requestHeaders = await auth.getRequestHeaders(progressStreamUrl);
    const authHeader = requestHeaders.get('Authorization');

    if (!authHeader) {
      return new NextResponse('Authentication failed', { status: 401 });
    }

    // Create a ReadableStream to handle the SSE proxying
    const stream = new ReadableStream({
      start(controller) {
        // Function to handle incoming SSE data from backend
        const handleSSE = async () => {
          try {
            // Make authenticated request to backend SSE endpoint
            const response = await fetch(`${BACKEND_URL}/api/v1/track/${task_id}/progress/stream?tenant_id=${tenantId}`, {
              headers: {
                'Authorization': authHeader,
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
              },
            });

            if (!response.ok) {
              const errorText = await response.text();
              controller.error(new Error(`Backend returned ${response.status}: ${errorText}`));
              return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
              controller.error(new Error('No response body from backend'));
              return;
            }

            // Read and forward the stream chunks
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              controller.enqueue(value);
            }

            controller.close();
          } catch (error) {
            console.error(`SSE stream error for task ${task_id}:`, error);
            controller.error(error);
          }
        };

        // Start handling the SSE
        handleSSE();
      },
    });

    // Return the stream with proper SSE headers
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    const { task_id } = await params;
    console.error(`Error setting up SSE stream for task ${task_id}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}