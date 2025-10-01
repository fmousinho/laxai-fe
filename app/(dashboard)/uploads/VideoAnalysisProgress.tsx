"use client";
import React, { useState, useEffect } from "react";

// State machine types
type UploadStateType = 
  | 'initial'           // drop zone only
  | 'uploading'         // progress bar shown
  | 'preparing'         // brief "Processing file..." after upload
  | 'ready'             // player + buttons shown
  | 'analysing'         // analysis in progress
  | 'analysis_complete' // analysis finished
  | 'failed_upload'     // upload failed
  | 'failed_analysis'   // analysis failed
  | 'deleting';         // file being deleted

interface VideoFile {
  fileName: string;
  fullPath?: string;
  signedUrl?: string;
  size?: number;
  created?: string;
}

interface AnalysisProgressItem {
  message: string;
  timestamp: string;
  type: string;
}

interface UploadState {
  type: UploadStateType;
  videoFile?: VideoFile;
  uploadProgress?: number;
  analysisTaskId?: string;
  analysisProgress?: AnalysisProgressItem[];
  error?: string;
}

interface VideoAnalysisProgressProps {
  uploadState: UploadState;
  setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;
  videoUrl: string | null;
}

export function VideoAnalysisProgress({ uploadState, setUploadState, videoUrl }: VideoAnalysisProgressProps) {
  const [showModal, setShowModal] = useState(false);
  const [pollingTimeout, setPollingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeout) {
        console.log('Cleaning up polling timeout');
        clearTimeout(pollingTimeout);
      }
    };
  }, [pollingTimeout]);

  // Stop polling when analysis completes or fails
  useEffect(() => {
    if (uploadState.type === 'analysis_complete' || uploadState.type === 'failed_analysis') {
      if (pollingTimeout) {
        console.log('Stopping polling after analysis completion/failure');
        clearTimeout(pollingTimeout);
        setPollingTimeout(null);
      }
    }
  }, [uploadState.type, pollingTimeout]);

  // Restart polling if component mounts with analysing state (e.g., page refresh)
  useEffect(() => {
    if (uploadState.type === 'analysing' && uploadState.analysisTaskId && !pollingTimeout) {
      console.log('Restarting polling for existing analysis task');
      startProgressPolling(uploadState.analysisTaskId);
    }
  }, [uploadState.type, uploadState.analysisTaskId, pollingTimeout]);

  // Function to poll progress updates
  const pollProgress = async (taskId: string) => {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log('Polling progress for task:', taskId, retryCount > 0 ? `(retry ${retryCount})` : '');
        const response = await fetch(`/api/track/${taskId}/progress`);

        if (response.status === 200) {
          // Success - process the data
          const data = await response.json();
          console.log('Polled progress data:', data);

          // Handle different status types from polling response
          setUploadState(prev => {
            console.log('Updating state with polled data, current type:', prev.type);
            let message = '';

            // Create more descriptive messages based on the data
            if (data.status === 'processing' && data.progress_percent !== undefined) {
              const progress = Math.round(data.progress_percent);
              const framesInfo = data.frames_processed && data.total_frames ?
                ` (${data.frames_processed}/${data.total_frames} frames)` : '';
              const detectionsInfo = data.detections_count ?
                ` - ${data.detections_count} detections` : '';
              message = `Processing: ${progress}% complete${framesInfo}${detectionsInfo}`;
            } else if (data.status === 'waiting') {
              message = 'Queued for analysis';
            } else if (data.status === 'started') {
              message = 'Analysis started';
            } else if (data.status === 'completed') {
              message = 'Analysis completed successfully';
            } else if (data.status === 'failed') {
              message = data.message || 'Analysis failed';
            } else if (data.message) {
              message = data.message;
            } else if (data.status) {
              message = `Status: ${data.status}`;
            } else {
              message = 'Analysis update received';
            }

            const newProgress = [...(prev.analysisProgress || []), {
              message,
              timestamp: new Date().toLocaleTimeString(),
              type: data.status || 'info'
            }];

            console.log('New progress item:', { message, type: data.status });

            switch (data.status) {
              case 'waiting':
              case 'started':
              case 'processing':
                return { ...prev, type: 'analysing' as const, analysisProgress: newProgress };
              case 'completed':
                return { ...prev, type: 'analysis_complete' as const, analysisProgress: newProgress };
              case 'failed':
                return { ...prev, type: 'failed_analysis' as const, analysisProgress: newProgress };
              default:
                return { ...prev, analysisProgress: newProgress };
            }
          });
          return; // Success - exit the function
        } else if (response.status === 404) {
          // Task not found - retry after 5 seconds
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`Task ${taskId} not found after ${maxRetries} attempts`);
          }
          console.log(`Task ${taskId} not found (404), retrying in 5 seconds... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue; // Retry the loop
        } else {
          // Any other non-success status - throw error immediately
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        setUploadState(prev => ({
          ...prev,
          type: 'failed_analysis',
          analysisProgress: [...(prev.analysisProgress || []), {
            message: 'Connection error - retrying...',
            timestamp: new Date().toISOString(),
            type: 'error'
          }]
        }));
        return; // Exit on any error
      }
    }
  };

  // Function to start polling progress updates
  const startProgressPolling = (taskId: string) => {
    console.log('Starting progress polling for task:', taskId);

    const pollSequentially = async () => {
      await pollProgress(taskId);
      
      // Only schedule next poll if still analysing
      if (uploadState.type === 'analysing') {
        const timeout = setTimeout(pollSequentially, 5000);
        setPollingTimeout(timeout);
      }
    };

    // Start first poll
    pollSequentially();
  };

  return (
    <div className="mt-6 text-center flex flex-col items-center gap-4">
      <p className="mb-2 text-lg font-medium">Analysing Video</p>
      <video
        src={videoUrl!}
        controls
        className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
        style={{ maxWidth: 400 }}
        onClick={() => setShowModal(true)}
      />
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <video
              src={videoUrl!}
              controls
              autoPlay
              className="rounded-lg border bg-black shadow-2xl"
              style={{ maxWidth: '90vw', maxHeight: '80vh' }}
            />
            <button
              className="absolute top-2 right-2 text-white bg-black/60 rounded-full px-3 py-1 text-lg font-bold hover:bg-black/80"
              onClick={() => setShowModal(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="text-sm text-muted-foreground">{uploadState.videoFile?.fileName}</div>
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
          Video Analysis in Progress
        </h3>

        {/* Current Status */}
        <div className="mb-3 p-2 bg-white rounded border">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Status:</span>
            <span className="text-blue-600 capitalize">
              {uploadState.analysisProgress?.[uploadState.analysisProgress.length - 1]?.message || 'Connecting...'}
            </span>
          </div>

          {/* Progress Bar for processing status */}
          {uploadState.analysisProgress?.some(msg => msg.message.includes('Processing:')) && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: (() => {
                    const latestProcessing = uploadState.analysisProgress
                      ?.filter(msg => msg.message.includes('Processing:'))
                      ?.pop();
                    const match = latestProcessing?.message.match(/(\d+)%/);
                    const progress = match ? parseInt(match[1], 10) : 0;
                    return `${Math.min(100, Math.max(0, progress))}%`;
                  })()
                }}
              ></div>
            </div>
          )}
        </div>

        {/* Progress Messages */}
        <div className="bg-white border rounded p-3 max-h-40 overflow-y-auto">
          <div className="space-y-2">
            {uploadState.analysisProgress?.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="animate-pulse w-2 h-2 bg-gray-400 rounded-full"></div>
                Connecting to analysis service...
              </div>
            ) : (
              uploadState.analysisProgress?.slice(-5).map((message, index) => {
                // Determine message type and styling
                const isProcessing = message.message.includes('Processing:');
                const isError = message.message.includes('error') || message.message.includes('Error') || message.message.includes('failed');
                const isComplete = message.message.includes('completed') || message.message.includes('finished');

                let icon = '📝';
                let bgColor = 'bg-gray-50';
                let textColor = 'text-gray-700';

                if (isProcessing) {
                  icon = '⚡';
                  bgColor = 'bg-blue-50';
                  textColor = 'text-blue-700';
                } else if (isError) {
                  icon = '❌';
                  bgColor = 'bg-red-50';
                  textColor = 'text-red-700';
                } else if (isComplete) {
                  icon = '✅';
                  bgColor = 'bg-green-50';
                  textColor = 'text-green-700';
                }

                return (
                  <div key={index} className={`flex items-start gap-2 p-2 rounded text-sm ${bgColor}`}>
                    <span className="text-xs mt-0.5">{icon}</span>
                    <span className={textColor}>{message.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {uploadState.analysisTaskId && (
          <div className="mt-3 text-xs text-blue-600 bg-blue-50 p-2 rounded">
            <strong>Task ID:</strong> {uploadState.analysisTaskId}
          </div>
        )}
      </div>
    </div>
  );
}