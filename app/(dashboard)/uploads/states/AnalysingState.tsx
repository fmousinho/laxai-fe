"use client";
import React, { useState, useEffect, useRef } from "react";
import { UploadState, AnalysingSubstateType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Circle, Loader2 } from 'lucide-react';

// State machine types


interface AnalysingStateProps {
  uploadState: Extract<UploadState, { type: 'analysing' }>;
  setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;
}

const COUNTDOWN_DURATION = 180; // 3 minutes
const POLLING_INTERVAL = 5000; // 5 seconds

export function AnalysingState({ uploadState, setUploadState }: AnalysingStateProps) {
  // Helper functions for countdown persistence - using endTime instead of startTime + duration
  // Use video file name as key since it persists across navigation
  const getStoredCountdown = (fileName: string): number | null => {
    if (typeof window === 'undefined') return null;
    
    const key = `analysis_countdown_${fileName}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    try {
      const { endTime } = JSON.parse(stored);
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((new Date(endTime).getTime() - now) / 1000));
      return remaining > 0 ? remaining : null;
    } catch (error) {
      console.error('Error parsing stored countdown:', error);
      return null;
    }
  };

  const storeCountdown = (fileName: string, duration: number) => {
    try {
      // Check if we already have a stored countdown with endTime
      const existing = localStorage.getItem(`analysis_countdown_${fileName}`);
      
      if (!existing) {
        // First time storing - calculate end time from now + duration
        const endTime = Date.now() + (duration * 1000);
        localStorage.setItem(`analysis_countdown_${fileName}`, JSON.stringify({ endTime }));
      }
      // If it already exists, don't update it - the end time is fixed
    } catch (error) {
      console.error('Error storing countdown in localStorage:', error);
    }
  };

  const clearStoredCountdown = (fileName: string) => {
    try {
      localStorage.removeItem(`analysis_countdown_${fileName}`);
    } catch (error) {
      console.error('Error clearing countdown from localStorage:', error);
    }
  };

  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(() => {
    // Initialize countdown from localStorage if available - use fileName as key
    const fileName = uploadState.videoFile?.fileName;
    const initialCountdown = fileName ? getStoredCountdown(fileName) : null;
    return initialCountdown;
  });
  const [analysingSubstate, setAnalysingSubstate] = useState<AnalysingSubstateType | null>(null);
  const [shouldPoll, setShouldPoll] = useState(false);
  const [framesProcessed, setFramesProcessed] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use ref to track polling state to avoid closure issues
  const shouldPollRef = useRef(false);
  // Store timeout ID in ref so we can clear it from cancel button before unmount
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track which task ID we're currently polling to prevent duplicate polls
  const currentPollingTaskIdRef = useRef<string | null>(null);

  // Initialize component state on mount
  useEffect(() => {
    const initialSubstate = uploadState.analysisTaskId ? 'not_started' : 'not_started';
    setAnalysingSubstate(initialSubstate);

    // Cleanup on unmount - ensure polling timeout is cleared
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Countdown timer effect
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      if (uploadState.videoFile?.fileName) {
        clearStoredCountdown(uploadState.videoFile.fileName);
      }
    }
  }, [countdown])



  useEffect(() => {
    switch (analysingSubstate) {

      case 'not_started':
        if (uploadState.analysisTaskId) {
          setShouldPoll(true);
          shouldPollRef.current = true;
          
          // Only initialize countdown if it's not already set
          if (countdown === null && uploadState.videoFile?.fileName) {
            const storedCountdown = getStoredCountdown(uploadState.videoFile.fileName);
            if (storedCountdown) {
              setCountdown(storedCountdown);
            } else {
              setCountdown(COUNTDOWN_DURATION);
              storeCountdown(uploadState.videoFile.fileName, COUNTDOWN_DURATION);
            }
          }
        } else {
          setShouldPoll(false);
          shouldPollRef.current = false;
        }
        break;
      case 'running':
        setShouldPoll(true);
        shouldPollRef.current = true;
        setCountdown(null);
        // Clear countdown from storage when analysis starts running
        if (uploadState.videoFile?.fileName) {
          clearStoredCountdown(uploadState.videoFile.fileName);
        }
        break;
      case 'completed':
        setShouldPoll(false);
        shouldPollRef.current = false;
        // Clear countdown when analysis completes
        if (uploadState.videoFile?.fileName) {
          clearStoredCountdown(uploadState.videoFile.fileName);
        }
        setUploadState({
          type: 'analysis_complete',
          videoFile: uploadState.videoFile, // Assuming prev state has this
          analysisTaskId: uploadState.analysisTaskId!, // Assuming prev state has this
        });
        break;
      case 'error':
        setShouldPoll(false);
        shouldPollRef.current = false;
        // Clear countdown when analysis errors
        if (uploadState.videoFile?.fileName) {
          clearStoredCountdown(uploadState.videoFile.fileName);
        }
        setUploadState({
          type: "failed_analysis",
          videoFile: uploadState.videoFile, // Assuming prev state has this
          analysisTaskId: uploadState.analysisTaskId!,
          error: errorMessage || "Unknown error"
        });
        break;
      case 'cancelled':
        setShouldPoll(false);
        shouldPollRef.current = false;
        // Clear countdown when analysis is cancelled
        if (uploadState.videoFile?.fileName) {
          clearStoredCountdown(uploadState.videoFile.fileName);
        }
        setUploadState({
          type: "failed_analysis",
          videoFile: uploadState.videoFile, // Assuming prev state has this
          analysisTaskId: uploadState.analysisTaskId!,
          error: "Analysis cancelled"
        });
        break;
    }
  }, [analysingSubstate, uploadState.analysisTaskId]);

  // Polling effect - simplified to prevent multiple concurrent polls
  useEffect(() => {
    const startPolling = () => {
      // Don't start polling if:
      // 1. We shouldn't poll
      // 2. No task ID
      // 3. Already polling this task
      // 4. Already polling a different task (wait for cleanup first)
      if (!shouldPoll || !uploadState.analysisTaskId) {
        return;
      }

      if (currentPollingTaskIdRef.current === uploadState.analysisTaskId) {
        // Already polling this task, no need to start again
        return;
      }

      if (currentPollingTaskIdRef.current && currentPollingTaskIdRef.current !== uploadState.analysisTaskId) {
        // Polling a different task, stop it first
        console.log(`Switching poll from task ${currentPollingTaskIdRef.current} to ${uploadState.analysisTaskId}`);
        stopPolling();
      }

      // Start polling for the new task
      currentPollingTaskIdRef.current = uploadState.analysisTaskId;

      const poll = async () => {
        if (!shouldPollRef.current || uploadState.type !== 'analysing') {
          return; // Stop if polling should be disabled
        }

        await pollProgress(uploadState.analysisTaskId!);

        // Schedule next poll only if we should continue polling
        if (shouldPollRef.current && currentPollingTaskIdRef.current === uploadState.analysisTaskId) {
          pollingTimeoutRef.current = setTimeout(poll, POLLING_INTERVAL);
        } else {
          pollingTimeoutRef.current = null;
        }
      };

      // Start the first poll
      poll();
    };

    const stopPolling = () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      currentPollingTaskIdRef.current = null;
    };

    if (shouldPoll && uploadState.analysisTaskId) {
      startPolling();
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [shouldPoll, uploadState.analysisTaskId]);

  
  // Function to poll progress updates
  const pollProgress = async (taskId: string) => {
    // Don't poll if we shouldn't be polling anymore (use ref to avoid closure issues)
    if (!shouldPollRef.current) {
      return;
    }

    try {
      console.log('Polling progress for task:', taskId);
      const response = await fetch(`/api/track/${taskId}/progress`);

      if (response.status === 200) {
        const data = await response.json();
        console.log('Polled progress data:', data);
        if (data.status) {
          setAnalysingSubstate(data.status as AnalysingSubstateType);
          if (data.status === 'running' || data.status === 'completed') {
            const processedFrames = data.frames_processed || 0;
            const totalFramesValue = data.total_frames || null;
            setFramesProcessed(processedFrames);
            setTotalFrames(totalFramesValue);
          }
        }
      } else if (response.status === 404) {
        console.error('Analysis task not found (404)');
      } else {
        console.error('API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error polling progress:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setAnalysingSubstate('error');
    }
  };

  // Note: We DON'T clear countdown on unmount - we want it to persist across navigation
  // Countdown is only cleared when analysis completes, fails, or is cancelled

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
        <h3 className="text-lg font-semibold mb-4 text-center">Steps</h3>
        <div className="space-y-3">

          {/* Activity 1: Initializing */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3 flex-1">
              {analysingSubstate === "not_started" && !uploadState.analysisTaskId ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
              <span className="text-sm font-medium">Requesting analysis</span>
            </div>
          </div>


          {/* Activity 2: Setting up backend services */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3 flex-1">
              {analysingSubstate === 'not_started' && countdown !== null ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : analysingSubstate === 'running' || analysingSubstate === 'completed' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Setting up backend services for analysis</span>
            </div>
            {analysingSubstate === 'not_started' && countdown !== null ? (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                <Clock className="w-3 h-3 mr-1" />
                {`${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`}
              </Badge>
            ) : null}
          </div>

          {/* Activity 3: Detecting players */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3 flex-1">
              {analysingSubstate === 'running' ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              ) : analysingSubstate === 'completed' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Detecting players</span>
            </div>
            {analysingSubstate === 'running' && totalFrames ? (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {`${framesProcessed} of ${totalFrames} frames`}
              </Badge>
            ) : null}
          </div>

          {/* Activity 4: Capturing and storing player images */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3 flex-1">
              {analysingSubstate === 'completed' ? (
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
                setShouldPoll(false);
                shouldPollRef.current = false;
                // Clear any pending polling timeout to prevent memory leak
                if (pollingTimeoutRef.current) {
                  clearTimeout(pollingTimeoutRef.current);
                  pollingTimeoutRef.current = null;
                }
                // Clear current polling task ref
                currentPollingTaskIdRef.current = null;
                // Update state to cancelled status
                setUploadState({
                  type: 'failed_analysis',
                  videoFile: uploadState.videoFile,
                  error: 'Analysis cancelled by user',
                  analysisTaskId: uploadState.analysisTaskId
                });
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