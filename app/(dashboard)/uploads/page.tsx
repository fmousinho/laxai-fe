
"use client";
import React, { useCallback, useState, useEffect } from "react";
import axios from "axios";
import { useErrorHandler } from '@/lib/useErrorHandler';
import { ErrorPage } from '@/components/ErrorPage';
// import { VideoAnalysisProgress } from './VideoAnalysisProgress';
import { RuntimeErrorBoundary } from './RuntimeErrorBoundary';
import { UploadState, UploadStateType, VideoFile } from './types';
import {
  InitialState,
  UploadingState,
  PreparingState,
  ReadyState,
  AnalysingState,
  AnalysisCompleteState,
  FailedUploadState,
  FailedAnalysisState,
  DeletingState
} from './states';

export default function Uploads() {
  const [hasCheckedExistingFiles, setHasCheckedExistingFiles] = useState(true);
  
  // Unified state management with persistence
  const [uploadState, setUploadState] = useState<UploadState>({ type: 'initial' });

  // Restore state from sessionStorage after mount (avoiding hydration mismatch)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('uploadState');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that it's a valid UploadState
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          setUploadState(parsed as UploadState);
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved upload state, using default:', e);
      // Clear corrupted dataAnaly
      sessionStorage.removeItem('uploadState');
    }
  }, []);

  // Persist state changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('uploadState', JSON.stringify(uploadState));
  }, [uploadState]);

  const { error: apiError, handleFetchError, handleApiError, clearError } = useErrorHandler();

  // On mount, check for existing videos if we are in the initial state
  useEffect(() => {
    const checkExistingFiles = async () => {
      if (uploadState.type === 'initial') {
        try {
          const { data } = await axios.get('/api/gcs/list_video?folder=raw');
          if (data.files && data.files.length > 0) {
            console.log('Found existing file, using it:', data.files[0]);
            setUploadState({
              type: 'ready',
              videoFile: data.files[0]
            });
          }
        } catch (e) {
          console.warn('Failed to check existing files:', e);
        } finally {
          setHasCheckedExistingFiles(true);
        }
      } else {
        setHasCheckedExistingFiles(true);
      }
    };
    checkExistingFiles();
  }, []);


  const handleUploadComplete = async (uploadSignedUrl: string, fileName: string) => {
    console.log('handleUploadComplete called with:', { uploadSignedUrl, fileName });

    try {
      // Get a read signed URL for the uploaded file
      console.log('Getting read signed URL for file:', fileName);
      const { data: listData } = await axios.get('/api/gcs/list_video?folder=raw');

      // Find the uploaded file in the list
      const uploadedFile = listData.files?.find((file: VideoFile) => file.fileName === fileName || file.fullPath?.endsWith(fileName)
      );

      if (!uploadedFile || !uploadedFile.signedUrl) {
        console.error('Could not find uploaded file in list or missing signed URL');
        setUploadState(prev => ({
          ...prev,
          type: 'failed_upload',
          error: 'Failed to get video URL after upload'
        }));
        return;
      }

      const readSignedUrl = uploadedFile.signedUrl;
      console.log('Got read signed URL:', readSignedUrl);

      // After upload, set video file and transition to preparing state
      setUploadState(prev => ({
        ...prev,
        type: 'preparing',
        videoFile: {
          fileName,
          signedUrl: readSignedUrl,
          fullPath: uploadedFile.fullPath || fileName
        }
      }));

      // Wait for the video to be actually accessible before transitioning to ready
      const checkVideoReady = async (): Promise<boolean> => {
        try {
          const response = await fetch(readSignedUrl, { method: 'HEAD' });
          return response.ok;
        } catch (error) {
          return false;
        }
      };

      // Poll every 500ms until video is ready, with a maximum of 10 seconds
      const maxAttempts = 20;
      let attempts = 0;

      const pollForVideo = async (): Promise<void> => {
        attempts++;
        const isReady = await checkVideoReady();

        if (isReady) {
          setUploadState(prev => {
            if (prev.type === 'preparing') {
              return { ...prev, type: 'ready' };
            }
            return prev;
          });
        } else if (attempts < maxAttempts) {
          setTimeout(pollForVideo, 500);
        } else {
          // If video is still not ready after 10 seconds, transition anyway
          setUploadState(prev => {
            if (prev.type === 'preparing') {
              return { ...prev, type: 'ready' };
            }
            return prev;
          });
        }
      };

      // Start polling
      setTimeout(pollForVideo, 500);
    } catch (error) {
      console.error('Error in handleUploadComplete:', error);
      setUploadState(prev => ({
        ...prev,
        type: 'failed_upload',
        error: 'Failed to process uploaded video'
      }));
    }
  };

  const handleDelete = async () => {
    if (uploadState.type !== 'ready' || !uploadState.videoFile) return;

    setUploadState(prev => ({ 
      type: 'deleting', 
      videoFile: (prev as Extract<UploadState, { type: 'ready'; }>).videoFile 
    }));

    try {
      const filePath = uploadState.videoFile!.fullPath || uploadState.videoFile!.fileName;
      await axios.delete('/api/gcs/delete_video', { data: { fileName: filePath } });

      // Check if there are other files
      const { data } = await axios.get('/api/gcs/list_video?folder=raw');
      // Filter out the deleted file in case the API returns stale data
      const remainingFiles = (data.files || []).filter((file: VideoFile) => (file.fullPath || file.fileName) !== filePath
      );

      if (remainingFiles.length > 0) {
        setUploadState({
          type: 'ready',
          videoFile: remainingFiles[0]
        });
      } else {
        setUploadState({ type: 'initial' });
      }
    } catch (err) {
      setUploadState(prev => ({
        type: 'ready',
        videoFile: (prev as Extract<UploadState, { type: 'deleting'; }>).videoFile
      }));
    }
  };

  const handleVideoAnalysis = async () => {
    if (uploadState.type !== 'ready' || !uploadState.videoFile) return;

    setUploadState(prev => ({
      type: 'analysing',
      videoFile: (prev as Extract<UploadState, { type: 'ready'; }>).videoFile,
      status: 'not_started' as const,
      analysisProgress: [],
      analysisTaskId: ''
    }));
    clearError();

    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_filename: uploadState.videoFile!.fileName,
        }),
      });

      const isOk = await handleFetchError(res, 'handleVideoAnalysis');
      if (!isOk) {
        setUploadState(prev => ({
          type: 'failed_analysis',
          videoFile: (prev as Extract<UploadState, { type: 'analysing'; }>).videoFile,
          error: 'Analysis request failed',
          analysisTaskId: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisTaskId
        }));
        return;
      }

      const data = await res.json();
      setUploadState(prev => ({
        type: 'analysing',
        videoFile: (prev as Extract<UploadState, { type: 'analysing'; }>).videoFile,
        analysisTaskId: data.task_id
      }));
    } catch (error) {
      console.error('Failed to start video analysis:', error);
      handleApiError(error, 'handleVideoAnalysis');
      setUploadState(prev => ({
        type: 'failed_analysis',
        videoFile: (prev as Extract<UploadState, { type: 'analysing'; }>).videoFile,
        error: 'Failed to start analysis',
        analysisTaskId: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisTaskId
      }));
    }
  };

    // Render functions for each state
    const renderContent = () => {
      switch (uploadState.type) {
        case 'initial':
          return (
            <InitialState
              uploadState={uploadState}
              setUploadState={setUploadState}
              onUploadComplete={handleUploadComplete}
              onUploadStart={() => setUploadState({ type: 'uploading', uploadProgress: 0 })}
              onUploadError={(error: string) => setUploadState({ type: 'failed_upload', error })}
            />
          );

        case 'uploading':
          return (
            <UploadingState
              uploadState={uploadState}
              setUploadState={setUploadState}
              onUploadCompleteAction={handleUploadComplete}
              onUploadStartAction={() => setUploadState({ type: 'uploading', uploadProgress: 0 })}
              onUploadErrorAction={(error) => setUploadState({ type: 'failed_upload', error })}
            />
          );

        case 'preparing':
          return (
            <PreparingState
              uploadState={uploadState}
              setUploadState={setUploadState}
            />
          );

        case 'ready':
          return (
            <ReadyState
              uploadState={uploadState as Extract<UploadState, { type: 'ready' }>}
              onDelete={handleDelete}
              onStartAnalysis={handleVideoAnalysis}
            />
          );

        case 'analysing':
          return (
            <AnalysingState
              uploadState={uploadState}
              setUploadState={setUploadState}
            />
          );

        case 'analysis_complete':
          return (
            <AnalysisCompleteState
              uploadState={uploadState as Extract<UploadState, { type: 'analysis_complete' }>}
              onReset={() => setUploadState({ type: 'initial' })}
            />
          );

        case 'failed_upload':
          return (
            <FailedUploadState
              uploadState={uploadState as Extract<UploadState, { type: 'failed_upload' }>}
              onRetry={() => setUploadState({ type: 'initial' })}
            />
          );

        case 'failed_analysis':
          return (
            <FailedAnalysisState
              uploadState={uploadState as Extract<UploadState, { type: 'failed_analysis' }>}
              onReset={() => setUploadState({ type: 'initial' })}
            />
          );

        case 'deleting':
          return <DeletingState />;

        default:
          return (
            <InitialState
              uploadState={uploadState}
              setUploadState={setUploadState}
              onUploadComplete={handleUploadComplete}
              onUploadStart={() => setUploadState({ type: 'uploading', uploadProgress: 0 })}
              onUploadError={(error: string) => setUploadState({ type: 'failed_upload', error })}
            />
          );
      }
    };  return (
    <RuntimeErrorBoundary>
      <div className="py-8">
        {!hasCheckedExistingFiles ? (
          <div className="text-center text-muted-foreground">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p>Loading...</p>
          </div>
        ) : apiError ? (
          <ErrorPage
            error={apiError}
            onRetry={clearError}
            onDismiss={clearError} />
        ) : (
          <>
            {renderContent()}
          </>
        )}
      </div>
    </RuntimeErrorBoundary>
  );

}


