"use client";
import React, { useState, useEffect, useRef } from "react";
import { UploadState, VideoFile, AnalysisProgressItem, UploadStateType, AnalysingSubstateType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Circle, Loader2 } from 'lucide-react';

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
  const [currentProgressStatus, setCurrentProgressStatus] = useState<AnalysingSubstateType | null>(null);

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

  // Initialize countdown on mount if we have a taskId
  useEffect(() => {
    if (uploadState.analysisTaskId) {
      const storedCountdown = getStoredCountdown(uploadState.analysisTaskId);
      if (storedCountdown !== null) {
        setCountdown(storedCountdown);
      }
    }
  }, [uploadState.analysisTaskId]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      if (uploadState.analysisTaskId) {
        clearStoredCountdown(uploadState.analysisTaskId);
      }
    }
  }, [countdown, uploadState.analysisTaskId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
        setPollingTimeout(null);
      }
    };
  }, [pollingTimeout]);

  // Stop polling when we leave analysing state
  useEffect(() => {
    if (uploadState.type !== 'analysing') {
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
        setPollingTimeout(null);
      }
      if (uploadState.analysisTaskId) {
        clearStoredCountdown(uploadState.analysisTaskId);
      }
    }
  }, [uploadState.type, uploadState.analysisTaskId, pollingTimeout]);

  // Start polling when component mounts with analysing state
  useEffect(() => {
    if (uploadState.type === 'analysing' && uploadState.analysisTaskId && !pollingTimeout) {
      startProgressPolling(uploadState.analysisTaskId);
    }
  }, [uploadState.type, uploadState.analysisTaskId, pollingTimeout]);

  // Determine if we should be polling
  const shouldPoll = uploadState.type === 'analysing' && 
                     (currentProgressStatus === null || currentProgressStatus === 'not_started' || currentProgressStatus === 'running');

  // Function to poll progress updates
  const pollProgress = async (taskId: string): Promise<AnalysingSubstateType | null> => {
    try {
      console.log('Polling progress for task:', taskId);
      const response = await fetch(`/api/track/${taskId}/progress`);

      if (response.status === 200) {
        const data = await response.json();
        console.log('Polled progress data:', data);

        // Update current progress status
        setCurrentProgressStatus(data.status);

        // Handle countdown for not_started status
        if (data.status === 'not_started' && countdown === null) {
          const countdownDuration = 180; // 3 minutes
          setCountdown(countdownDuration);
          storeCountdown(taskId, countdownDuration);
        } else if (data.status !== 'not_started' && countdown !== null) {
          // Clear countdown when status changes away from not_started
          setCountdown(null);
          clearStoredCountdown(taskId);
        }

        // Handle state transitions based on status
        setUploadState(prev => {
          let message = '';

          if (data.status === 'not_started') {
            message = 'Setting up analysis services...';
          } else if (data.status === 'running') {
            const framesProcessed = data.frames_processed || 0;
            const totalFrames = data.total_frames || 0;
            message = `Processed ${framesProcessed} out of ${totalFrames} frames`;
          } else if (data.status === 'completed') {
            message = 'Analysis completed successfully';
          } else if (data.status === 'cancelled') {
            message = 'Analysis was cancelled';
          } else if (data.status === 'error') {
            message = 'Analysis failed with an error';
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

          switch (data.status) {
            case 'not_started':
            case 'running':
              return { 
                type: 'analysing' as const, 
                videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, 
                status: data.status as AnalysingSubstateType,
                analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId, 
                analysisProgress: newProgress 
              };
            case 'completed':
              return { type: 'analysis_complete' as const, videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, analysisProgress: newProgress, analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId };
            case 'error':
            case 'cancelled':
              return { type: 'failed_analysis' as const, videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile, analysisProgress: newProgress, error: data.status === 'error' ? 'Analysis failed with an error' : 'Analysis cancelled', analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId };
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

        return data.status;
      } else if (response.status === 404) {
        // Task not found - retry after 5 seconds
        console.log(`Task ${taskId} not found (404), retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await pollProgress(taskId); // Retry
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error polling progress:', error);
      setUploadState(prev => ({
        type: 'failed_analysis',
        videoFile: (prev as Extract<UploadState, { type: 'analysing' }>).videoFile,
        analysisProgress: [...(prev as Extract<UploadState, { type: 'analysing' }>).analysisProgress, {
          message: 'Connection error',
          timestamp: new Date().toISOString(),
          type: 'error'
        }],
        error: 'Connection error',
        analysisTaskId: (prev as Extract<UploadState, { type: 'analysing' }>).analysisTaskId
      }));
      return null;
    }
  };

  // Function to start polling progress updates
  const startProgressPolling = (taskId: string) => {
    console.log('Starting progress polling for task:', taskId);

    const pollSequentially = async () => {
      const status = await pollProgress(taskId);
      
      // Schedule next poll if conditions still met
      const currentShouldPoll = uploadState.type === 'analysing' && 
                               (status === null || status === 'not_started' || status === 'running');
      
      if (currentShouldPoll) {
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
            <div className="flex items-center gap-3 flex-1">
              {currentProgressStatus === null || currentProgressStatus === 'not_started' ? (
                <Circle className="w-4 h-4 text-muted-foreground" />
              ) : currentProgressStatus === 'running' ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              <span className="text-sm font-medium">Setting up backend services for analysis</span>
            </div>
            {currentProgressStatus === 'not_started' && countdown !== null && (
              <Badge variant="secondary" className="text-orange-600 border-orange-200">
                <Clock className="w-3 h-3 mr-1" />
                {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </Badge>
            )}
          </div>

          {/* Activity 2: Detecting players */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3 flex-1">
              {currentProgressStatus === 'running' ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : currentProgressStatus === 'completed' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Detecting players</span>
            </div>
            {currentProgressStatus === 'running' && uploadState.analysisProgress?.some(msg => msg.message.includes('Processed')) && (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
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
              </Badge>
            )}
          </div>

          {/* Activity 3: Capturing and storing player images */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3 flex-1">
              {currentProgressStatus === 'completed' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Capturing and storing player images</span>
            </div>
          </div>
        </div>
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