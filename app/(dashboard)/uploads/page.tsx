
"use client";
import React, { useCallback, useState, useEffect, useRef } from "react";
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
  const [isStateRestored, setIsStateRestored] = useState(false);
  const [hasCheckedExistingFiles, setHasCheckedExistingFiles] = useState(false);
  const hasCheckedRef = useRef(false);

  const [uploadState, setUploadState] = useState<UploadState>(() => {
    // Only access sessionStorage on the client side
    if (typeof window === 'undefined') {
      return { type: 'initial' };
    }
    try {
      const saved = sessionStorage.getItem('uploadState');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          console.log('Restored upload state from sessionStorage:', parsed);
          setIsStateRestored(true);
          return parsed as UploadState;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved upload state, using default:', e);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('uploadState');
      }
    }
    return { type: 'initial' };
  });

  // Set hasCheckedExistingFiles to true when we're not in initial state
  useEffect(() => {
    if (uploadState.type !== 'initial') {
      setHasCheckedExistingFiles(true);
    }
  }, [uploadState.type]);

  // Check for existing files when initially in initial state
  useEffect(() => {
    if (uploadState.type !== 'initial' || hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;
    const checkExistingFiles = async () => {
      try {
        console.log('Checking for existing files...');
        const { data } = await axios.get('/api/gcs/list_video?folder=raw');
        console.log('GCS list_video response:', data);
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
    };
    checkExistingFiles();
  }, []);

  // Persist state changes to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('uploadState', JSON.stringify(uploadState));
    }
  }, [uploadState]);

  const { error: apiError, handleFetchError, handleApiError, clearError } = useErrorHandler();

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

    console.log('Starting delete operation for file:', uploadState.videoFile);
    setUploadState(prev => ({ 
      type: 'deleting', 
      videoFile: (prev as Extract<UploadState, { type: 'ready'; }>).videoFile 
    }));

    try {
      const filePath = uploadState.videoFile!.fullPath || uploadState.videoFile!.fileName;
      console.log('Deleting file with path:', filePath);
      await axios.delete('/api/gcs/delete_video', { data: { fileName: filePath } });
      console.log('Delete API call completed');

      // Check if there are other files
      console.log('Checking for remaining files...');
      const { data } = await axios.get('/api/gcs/list_video?folder=raw');
      console.log('List API response:', data);
      // Filter out the deleted file in case the API returns stale data
      const remainingFiles = (data.files || []).filter((file: VideoFile) => (file.fullPath || file.fileName) !== filePath
      );
      console.log('Remaining files:', remainingFiles);

      if (remainingFiles.length > 0) {
        setUploadState({
          type: 'ready',
          videoFile: remainingFiles[0]
        });
      } else {
        setUploadState({ type: 'initial' });
        setHasCheckedExistingFiles(true); // We just checked, no need to check again
      }
      console.log('Delete operation completed successfully');
    } catch (err) {
      console.error('Delete operation failed:', err);
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
          analysisTaskId: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisTaskId!
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
        analysisTaskId: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisTaskId!
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
        {uploadState.type === 'initial' && !hasCheckedExistingFiles ? (
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


