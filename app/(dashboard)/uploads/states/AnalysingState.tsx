"use client";
import React, { useState, useEffect, useRef } from "react";
import { UploadState, AnalysingSubstateType } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Circle, Loader2 } from 'lucide-react';
import { set } from "zod";
import { clear } from "console";

// State machine types


interface AnalysingStateProps {
  uploadState: Extract<UploadState, { type: 'analysing' }>;
  setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;
}

const COUNTDOWN_DURATION = 180; // 3 minutes
const POLLING_INTERVAL = 5000; // 5 seconds

export function AnalysingState({ uploadState, setUploadState }: AnalysingStateProps) {
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [analysingSubstate, setAnalysingSubstate] = useState<AnalysingSubstateType | null>('not_started');
  const [shouldPoll, setShouldPoll] = useState(false);
  const [framesProcessed, setFramesProcessed] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use ref to track polling state to avoid closure issues
  const shouldPollRef = useRef(false);


  const getStoredSubstate = (): AnalysingSubstateType | null => {
    try {
      const stored = localStorage.getItem(`analysis_substate_${uploadState.analysisTaskId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading substate from localStorage:', error);
    }
    return null;
  };

  const clearStoredSubstate = () => {
    try {
      localStorage.removeItem(`analysis_substate_${uploadState.analysisTaskId}`);
    } catch (error) {
      console.error('Error clearing substate from localStorage:', error);
    }
  };

  const storeSubstate = (substate: AnalysingSubstateType) => {
    try {
      localStorage.setItem(`analysis_substate_`, JSON.stringify(substate));
    } catch (error) {
      console.error('Error storing substate in localStorage:', error);
    }
  };

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
  }, [countdown])



  useEffect(() => {
    switch (analysingSubstate) {

      case 'not_started':
        storeSubstate('not_started');
        if (uploadState.analysisTaskId) {
          setShouldPoll(true);
          shouldPollRef.current = true;
          const storedCountdown = getStoredCountdown(uploadState.analysisTaskId);
          if (storedCountdown) {
            setCountdown(storedCountdown);
          } else {
            setCountdown(COUNTDOWN_DURATION);
            storeCountdown(uploadState.analysisTaskId, COUNTDOWN_DURATION);
          }
        } else {
          setShouldPoll(false);
          shouldPollRef.current = false;
        }
        break;
      case 'running':
        storeSubstate('running');
        setShouldPoll(true);
        shouldPollRef.current = true;
        setCountdown(null);
        break;
      case 'completed':
        clearStoredSubstate();
        setShouldPoll(false);
        shouldPollRef.current = false;
        setUploadState({
          type: 'analysis_complete',
          videoFile: uploadState.videoFile, // Assuming prev state has this
          analysisTaskId: uploadState.analysisTaskId!, // Assuming prev state has this
        });
        break;
      case 'error':
        clearStoredSubstate();
        setShouldPoll(false);
        shouldPollRef.current = false;
        setUploadState({
          type: "failed_analysis",
          videoFile: uploadState.videoFile, // Assuming prev state has this
          analysisTaskId: uploadState.analysisTaskId!,
          error: errorMessage || "Unknown error"
        });
        break;
      case 'cancelled':
        clearStoredSubstate();
        setShouldPoll(false);
        shouldPollRef.current = false;
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
    let timeoutId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (shouldPoll && uploadState.analysisTaskId && !timeoutId) {
        const poll = async () => {
          if (!shouldPollRef.current || uploadState.type !== 'analysing') {
            return; // Stop if polling should be disabled
          }

          await pollProgress(uploadState.analysisTaskId);

          // Schedule next poll only if we should continue polling
          if (shouldPollRef.current) {
            timeoutId = setTimeout(poll, POLLING_INTERVAL);
          } else {
            timeoutId = null;
          }
        };

        // Start the first poll
        poll();
      }
    };

    const stopPolling = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
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
          if (data.status === 'running') {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear stored countdown
      if (uploadState.analysisTaskId) {
        clearStoredCountdown(uploadState.analysisTaskId);
      }
    };
  }, [uploadState.analysisTaskId]);

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
                // Clear countdown from localStorage
                clearStoredCountdown(uploadState.analysisTaskId);
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