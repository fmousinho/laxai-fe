"use client";
import React, { useState, useEffect, useRef } from "react";
import { UploadState, VideoFile, AnalysisProgressItem, UploadStateType, AnalysingSubstateType } from '../types';
import { Button } from '@/components/ui/button';

// State machine types

interface AnalysisTask {
  taskId: string;
  status: AnalysingSubstateType;
  statusMessage?: string;
  framesProcessed?: number;
  totalFrames?: number;
  error?: string;
}


interface AnalysingStateProps {
  uploadState: Extract<UploadState, { type: 'analysing' }>;
  setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;
}

export function AnalysingState({ uploadState, setUploadState }: AnalysingStateProps) {
  const [showModal, setShowModal] = useState(false);
  const [pollingTimeout, setPollingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownStartedRef = useRef(false);
  const stopPollingRef = useRef(false);

  // Helper function to get countdown from localStorage
  const getStoredCountdown = (taskId: string): number | null => {
    try {
      const stored = localStorage.getItem(`analysis_countdown_${taskId}`);
      if (stored) {
        const { startTime, duration } = JSON.parse(stored);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        return remaining > 0 ? remaining : null;
      }
    } catch (error) {
      console.error('Error reading countdown from localStorage:', error);
    }
    return null;
  };

  // Helper function to store countdown in localStorage
  const storeCountdown = (taskId: string, duration: number) => {
    try {
      const startTime = Date.now();
      localStorage.setItem(`analysis_countdown_${taskId}`, JSON.stringify({
        startTime,
        duration
      }));
    } catch (error) {
      console.error('Error storing countdown in localStorage:', error);
    }
  };

  // Helper function to clear countdown from localStorage
  const clearStoredCountdown = (taskId: string) => {
    try {
      localStorage.removeItem(`analysis_countdown_${taskId}`);
    } catch (error) {
      console.error('Error clearing countdown from localStorage:', error);
    }
  };

  // Countdown timer for initializing status
  useEffect(() => {
    if (uploadState.analysisTaskId) {
      // Check if there's a stored countdown for this task
      const storedCountdown = getStoredCountdown(uploadState.analysisTaskId);
      if (storedCountdown !== null) {
        setCountdown(storedCountdown);
        countdownStartedRef.current = true;
      }
    }
  }, [uploadState.analysisTaskId]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        const newCountdown = countdown - 1;
        setCountdown(newCountdown);
        
        // Clear localStorage when countdown reaches 0
        if (newCountdown === 0 && uploadState.analysisTaskId) {
          clearStoredCountdown(uploadState.analysisTaskId);
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      countdownStartedRef.current = false;
      // Clear localStorage when countdown naturally expires
      if (uploadState.analysisTaskId) {
        clearStoredCountdown(uploadState.analysisTaskId);
      }
    }
  }, [countdown, uploadState.analysisTaskId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeout) {
        console.log('Cleaning up polling timeout');
        clearTimeout(pollingTimeout);
      }
      // Clear any countdown data on unmount (optional - could be kept for page refresh persistence)
      // if (uploadState.analysisTaskId) {
      //   clearStoredCountdown(uploadState.analysisTaskId);
      // }
    };
  }, [pollingTimeout]);

  // Stop polling when analysis completes or fails
  useEffect(() => {
    if (uploadState.type != 'analysing') {
      if (pollingTimeout) {
        console.log('Stopping polling after analysis completion/failure');
        clearTimeout(pollingTimeout);
        setPollingTimeout(null);
      }
      // Clear countdown from localStorage when analysis is no longer running
      if (uploadState.analysisTaskId) {
        clearStoredCountdown(uploadState.analysisTaskId);
      }
    }
  }, [uploadState.type, uploadState.analysisTaskId]);

  // Restart polling if component mounts with analysing state (e.g., page refresh)
  useEffect(() => {
    if (uploadState.type === 'analysing' && uploadState.analysisTaskId && !pollingTimeout) {
      console.log('Restarting polling for existing analysis task');
      stopPollingRef.current = false;
      startProgressPolling(uploadState.analysisTaskId);
    }
  }, [pollingTimeout]);

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

                    // Handle countdown separately to avoid setState during render
          console.log('Countdown ref before check:', countdownStartedRef.current);
          if ((data.status === 'initializing' || data.status === 'not_started') && !countdownStartedRef.current) {
            console.log('Setting countdown: ref was false, status:', data.status);
            countdownStartedRef.current = true;
            const countdownDuration = 180; // 3 minutes
            setCountdown(countdownDuration);
            // Store countdown in localStorage for persistence across page navigation
            if (taskId) {
              storeCountdown(taskId, countdownDuration);
            }
          }

          // Handle different status types from polling response
          setUploadState(prev => {
            console.log('Updating state with polled data, current type:', prev.type);
            let message = '';

            // Create messages based on the new status types
            if (data.status === 'initializing') {
              message = 'Setting up analysis services...';
            } else if (data.status === 'running') {
              const framesProcessed = data.frames_processed || 0;
              const totalFrames = data.total_frames || 0;
              message = `Processed ${framesProcessed} out of ${totalFrames} frames`;
            } else if (data.status === 'completed') {
              message = 'Analysis completed successfully';
            } else if (data.status === 'cancelled' || data.status === 'failed') {
              message = 'Analysis was cancelled';
            } else if (data.message) {
              message = data.message;
            } else if (data.status) {
              message = `Status: ${data.status}`;
            } else {
              message = 'Analysis update received';
            }

            const newProgress = [...((prev as Extract<UploadState, { type: 'analysing' }>).analysisProgress || []), {
              message,
              timestamp: new Date().toLocaleTimeString(),
              type: data.status || 'info'
            }];

            console.log('New progress item:', { message, type: data.status });

            switch (data.status) {
              case 'initializing':
              case 'running':
                return { 
                  type: 'analysing' as const, 
                  videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, 
                  status: data.status as AnalysingSubstateType,
                  analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId, 
                  analysisProgress: newProgress 
                };
              case 'completed':
                stopPollingRef.current = true;
                return { type: 'analysis_complete' as const, videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, analysisProgress: newProgress, analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId };
              case 'cancelled':
                stopPollingRef.current = true;
                return { type: 'failed_analysis' as const, videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, analysisProgress: newProgress, error: 'Analysis cancelled', analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId };
              case 'failed':
                stopPollingRef.current = true;
                return { type: 'failed_analysis' as const, videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, analysisProgress: newProgress, error: 'Analysis failed', analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId };
              default:
                return { 
                  type: 'analysing' as const, 
                  videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, 
                  status: (prev as Extract<UploadState, { type: 'analysing' }>).status,
                  analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId, 
                  analysisProgress: newProgress 
                };
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
          type: 'failed_analysis',
          videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile,
          analysisProgress: [...(prev as Extract<UploadState, { type: 'analysing' }>).analysisProgress, {
            message: 'Connection error - retrying...',
            timestamp: new Date().toISOString(),
            type: 'error'
          }],
          error: 'Connection error',
          analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId
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
      
      // Only schedule next poll if still analysing and not stopped
      if (!stopPollingRef.current && uploadState.type === 'analysing') {
        const timeout = setTimeout(pollSequentially, 5000);
        setPollingTimeout(timeout);
      }
    };

    // Start first poll
    pollSequentially();
  };

  return (
    <div className="mt-6 text-center flex flex-col items-center gap-4">
      <p className="mb-2 text-lg font-medium">Video Analysis</p>
      <video
        src={uploadState.videoFile?.signedUrl!}
        className="mx-auto max-h-64 rounded-lg border bg-black"
        style={{ maxWidth: 400 }}
        onClick={() => setShowModal(true)}
      />
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <video
              src={uploadState.videoFile?.signedUrl!}
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

      {/* Analysis Activities */}
      <div className="mt-6 w-full max-w-md mx-auto">
        <h3 className="text-lg font-semibold mb-4 text-center">Analysis Activities</h3>
        <div className="space-y-3">
          {/* Activity 1: Setting up backend services */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                uploadState.status === 'initializing' ? 'bg-yellow-400' :
                ['running', 'completed'].includes(uploadState.status) ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm font-medium">Setting up backend services for analysis</span>
            </div>
            {uploadState.status === 'initializing' && countdown !== null && (
              <span className="text-xs text-orange-600 font-mono">
                {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>

          {/* Activity 2: Detecting players */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                uploadState.status === 'running' ? 'bg-yellow-400' :
                uploadState.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm font-medium">Detecting players</span>
            </div>
            {uploadState.status === 'running' && uploadState.analysisProgress?.some(msg => msg.message.includes('Processed')) && (
              <span className="text-xs text-blue-600">
                {(() => {
                  const latestProcessing = uploadState.analysisProgress
                    ?.filter(msg => msg.message.includes('Processed'))
                    ?.pop();
                  if (latestProcessing) {
                    const match = latestProcessing.message.match(/Processed (\d+) out of (\d+)/);
                    if (match) {
                      return `${match[1]} of ${match[2]}`;
                    }
                  }
                  return '';
                })()}
              </span>
            )}
          </div>

          {/* Activity 3: Capturing and storing player images */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                uploadState.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-sm font-medium">Capturing and storing player images</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
          {countdown !== null ? 'Initializing Analysis' : 'Video Analysis in Progress'}
        </h3>

        {/* Current Status */}
        <div className="mb-3 p-3 bg-white rounded border">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Status:</span>
            <span className="text-blue-600 capitalize flex items-center gap-2">
              {(() => {
                const latestMessage = uploadState.analysisProgress?.[uploadState.analysisProgress.length - 1];
                const message = latestMessage?.message || 'Connecting...';
                const type = latestMessage?.type || 'info';

                // Add whimsical emojis based on status type
                let emoji = '🔄';
                if (type === 'initializing') emoji = '🚀';
                else if (type === 'running') emoji = '⚡';
                else if (type === 'completed') emoji = '🎉';
                else if (type === 'error' || type === 'failed') emoji = '😵';
                else if (type === 'cancelled') emoji = '🛑';

                return (
                  <>
                    <span>{emoji}</span>
                    <span>{message}</span>
                  </>
                );
              })()}
            </span>
          </div>

          {/* Countdown Timer for initializing status */}
          {countdown !== null && (
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="font-medium text-gray-700">Time remaining:</span>
              <span className="text-orange-600 font-mono text-lg">
                ⏱️ {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Enhanced Progress Bar for running status */}
          {uploadState.analysisProgress?.some(msg => msg.message.includes('Processed')) && (
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>
                  {(() => {
                    const latestProcessing = uploadState.analysisProgress
                      ?.filter(msg => msg.message.includes('Processed'))
                      ?.pop();
                    if (latestProcessing) {
                      const match = latestProcessing.message.match(/Processed (\d+) out of (\d+)/);
                      if (match) {
                        const processed = parseInt(match[1], 10);
                        const total = parseInt(match[2], 10);
                        return `${Math.round((processed / total) * 100)}%`;
                      }
                    }
                    return '0%';
                  })()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 transition-all duration-500 ease-out shadow-sm"
                  style={{
                    width: (() => {
                      const latestProcessing = uploadState.analysisProgress
                        ?.filter(msg => msg.message.includes('Processed'))
                        ?.pop();
                      if (latestProcessing) {
                        const match = latestProcessing.message.match(/Processed (\d+) out of (\d+)/);
                        if (match) {
                          const processed = parseInt(match[1], 10);
                          const total = parseInt(match[2], 10);
                          return total > 0 ? `${Math.min(100, Math.max(0, (processed / total) * 100))}%` : '0%';
                        }
                      }
                      return '0%';
                    })()
                  }}
                >
                  <div className="h-full bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {uploadState.analysisTaskId && (
          <div className="mt-3 text-xs text-blue-600 bg-blue-50 p-2 rounded">
            <strong>Task ID:</strong> {uploadState.analysisTaskId}
          </div>
        )}
      </div>

      {/* Cancel Analysis Button */}
      <div className="mt-6">
        <Button
          variant="outline"
          className="px-6 py-2 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
          onClick={async () => {
            if (!uploadState.analysisTaskId) {
              console.error('No task ID available for cancellation');
              return;
            }

            try {
              const response = await fetch(`/api/track/${uploadState.analysisTaskId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                console.log('Analysis cancelled successfully');
                // Stop polling
                stopPollingRef.current = true;
                if (pollingTimeout) {
                  clearTimeout(pollingTimeout);
                  setPollingTimeout(null);
                }
                // Clear countdown from localStorage
                clearStoredCountdown(uploadState.analysisTaskId);
                // Update state to cancelled status
                setUploadState(prev => ({
                  type: 'failed_analysis',
                  videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile,
                  analysisProgress: [...(prev as Extract<UploadState, { type: 'analysing' }>).analysisProgress, {
                    message: 'Analysis cancelled by user',
                    timestamp: new Date().toISOString(),
                    type: 'cancelled'
                  }],
                  error: 'Analysis cancelled by user',
                  analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId
                }));
              } else {
                console.error('Failed to cancel analysis:', response.statusText);
                // Could show an error message to the user here
              }
            } catch (error) {
              console.error('Error cancelling analysis:', error);
              // Could show an error message to the user here
            }
          }}
        >
          Cancel Analysis
        </Button>
      </div>
    </div>
  );
}