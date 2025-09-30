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
    const requestHeaders = await client.getRequestHeaders(progressStreamUrl);
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

              // Convert Uint8Array to string for processing
              const chunk = new TextDecoder().decode(value);
              console.log(`SSE chunk for task ${task_id}:`, chunk);

              // Try to sanitize the chunk if it contains JSON that might have serialization issues
              let sanitizedChunk = chunk;
              try {
                // If this is a data line with JSON, try to parse and re-serialize it
                if (chunk.startsWith('data: ')) {
                  const jsonStr = chunk.substring(6); // Remove 'data: ' prefix
                  
                  // Check if this contains DatetimeWithNanoseconds error before parsing
                  if (jsonStr.includes('DatetimeWithNanoseconds') && jsonStr.includes('not JSON serializable')) {
                    console.warn(`Backend serialization error detected for task ${task_id}, sending sanitized error`);
                    sanitizedChunk = 'data: {"status": "failed", "message": "Analysis failed due to backend serialization error"}\n\n';
                  } else {
                    const parsed = JSON.parse(jsonStr);
                    
                    // Re-serialize to ensure it's valid JSON
                    const sanitizedJson = JSON.stringify(parsed);
                    sanitizedChunk = `data: ${sanitizedJson}`;
                  }
                }
              } catch (parseError) {
                // If parsing fails, check if it's a known serialization error
                if (chunk.includes('DatetimeWithNanoseconds') && chunk.includes('not JSON serializable')) {
                  console.warn(`Backend serialization error for task ${task_id}, sending sanitized error`);
                  sanitizedChunk = 'data: {"status": "failed", "message": "Analysis failed due to backend serialization error"}\n\n';
                } else {
                  console.warn(`Failed to sanitize SSE chunk for task ${task_id}:`, parseError);
                  // Keep original chunk if we can't sanitize it
                }
              }

              controller.enqueue(new TextEncoder().encode(sanitizedChunk));
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