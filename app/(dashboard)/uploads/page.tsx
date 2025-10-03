
"use client";
import React, { useCallback, useState, useEffect } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import { useErrorHandler } from '@/lib/useErrorHandler';
import { ErrorPage } from '@/components/ErrorPage';
import { VideoAnalysisProgress } from './VideoAnalysisProgress';
import { RuntimeErrorBoundary } from './RuntimeErrorBoundary';
import { UploadingState, GCSVideoUploader } from './UploadingState';
import { UploadState, UploadStateType, VideoFile } from './types';

export default function Uploads() {
  const [showModal, setShowModal] = useState(false);
  const [hasCheckedExistingFiles, setHasCheckedExistingFiles] = useState(true);
  
  // Unified state management with persistence
  const [uploadState, setUploadState] = useState<UploadState>(() => {
    // Try to restore from sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('uploadState');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Validate that it's a valid UploadState
          if (parsed && typeof parsed === 'object' && 'type' in parsed) {
            return parsed as UploadState;
          }
        }
      } catch (e) {
        console.warn('Failed to parse saved upload state, using default:', e);
        // Clear corrupted data
        sessionStorage.removeItem('uploadState');
      }
    }
    return { type: 'initial' };
  });

  // Persist state changes to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('uploadState', JSON.stringify(uploadState));
    }
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
            analysisProgress: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisProgress,
            error: 'Analysis request failed',
            analysisTaskId: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisTaskId
          }));
          return;
        }

        const data = await res.json();
        setUploadState(prev => ({
          type: 'analysing',
          videoFile: (prev as Extract<UploadState, { type: 'analysing'; }>).videoFile,
          status: 'running' as const,
          analysisProgress: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisProgress,
          analysisTaskId: data.task_id
        }));
      } catch (error) {
        console.error('Failed to start video analysis:', error);
        handleApiError(error, 'handleVideoAnalysis');
        setUploadState(prev => ({
          type: 'failed_analysis',
          videoFile: (prev as Extract<UploadState, { type: 'analysing'; }>).videoFile,
          analysisProgress: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisProgress,
          error: 'Failed to start analysis',
          analysisTaskId: (prev as Extract<UploadState, { type: 'analysing'; }>).analysisTaskId
        }));
      }
    };

    const videoUrl = ('videoFile' in uploadState && uploadState.videoFile?.signedUrl) || null;

    // Render functions for each state
    const renderContent = () => {
      switch (uploadState.type) {
        case 'initial':
          return <GCSVideoUploader
            onUploadCompleteAction={handleUploadComplete}
            onUploadStartAction={() => setUploadState({ type: 'uploading', uploadProgress: 0 })}
            onUploadErrorAction={(error: string) => setUploadState({ type: 'failed_upload', error })} />;

        case 'uploading':
          return <UploadingState
            onUploadCompleteAction={handleUploadComplete}
            onUploadStartAction={() => setUploadState({ type: 'uploading', uploadProgress: 0 })}
            onUploadErrorAction={(error) => setUploadState({ type: 'failed_upload', error })}
          />;

        case 'preparing':
          return <GCSVideoUploader
            onUploadCompleteAction={handleUploadComplete}
            onUploadStartAction={() => setUploadState({ type: 'uploading', uploadProgress: 0 })}
            onUploadErrorAction={(error: string) => setUploadState({ type: 'failed_upload', error })}
            isPreparing={true} />;

        case 'ready':
          return (
            <div className="mt-6 text-center flex flex-col items-center gap-4">
              <p className="mb-2 text-lg font-medium">Video uploaded!</p>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
                  style={{ maxWidth: 400 }}
                  onClick={() => setShowModal(true)}
                  onError={(e) => console.error('Video load error:', e)}
                  onLoadStart={() => console.log('Video load started')}
                  onLoadedData={() => console.log('Video data loaded')} />
              ) : (
                <div className="text-red-500">Video URL not available</div>
              )}
              {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <video
                      src={videoUrl!}
                      controls
                      autoPlay
                      className="rounded-lg border bg-black shadow-2xl"
                      style={{ maxWidth: '90vw', maxHeight: '80vh' }} />
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
              <div className="flex gap-4 mt-2">
                <button
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition"
                  onClick={handleDelete}
                >
                  Delete
                </button>
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                  onClick={handleVideoAnalysis}
                >
                  Start Video Analysis
                </button>
              </div>
            </div>
          );

        case 'analysing':
          return (
            <VideoAnalysisProgress
              uploadState={uploadState}
              setUploadState={setUploadState} />
          );

        case 'analysis_complete':
          return (
            <div className="mt-6 text-center flex flex-col items-center gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg max-w-md mx-auto">
                <h3 className="font-semibold text-green-800">Analysis Completed!</h3>
                <p className="text-sm text-green-700 mt-1">Video analysis has finished successfully.</p>
                {uploadState.analysisTaskId && (
                  <p className="text-xs text-green-600 mt-2">Task ID: {uploadState.analysisTaskId}</p>
                )}
                <button
                  className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                  onClick={() => setUploadState({ type: 'initial' })}
                >
                  OK
                </button>
              </div>
            </div>
          );

        case 'failed_upload':
          return (
            <div className="text-center">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
                <h3 className="font-semibold text-red-800">Upload Failed</h3>
                <p className="text-sm text-red-700 mt-1">{uploadState.error || 'An error occurred during upload.'}</p>
                <button
                  className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                  onClick={() => setUploadState({ type: 'initial' })}
                >
                  Try Again
                </button>
              </div>
            </div>
          );

        case 'failed_analysis':
          return (
            <div className="mt-6 text-center flex flex-col items-center gap-4">
              <p className="mb-2 text-lg font-medium">Video uploaded!</p>
              <video
                src={videoUrl!}
                controls
                className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
                style={{ maxWidth: 400 }}
                onClick={() => setShowModal(true)} />
              {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <video
                      src={videoUrl!}
                      controls
                      autoPlay
                      className="rounded-lg border bg-black shadow-2xl"
                      style={{ maxWidth: '90vw', maxHeight: '80vh' }} />
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
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
                <h3 className="font-semibold text-red-800">Analysis Failed</h3>
                <p className="text-sm text-red-700 mt-1">Video analysis encountered an error.</p>
                {uploadState.analysisTaskId && (
                  <p className="text-xs text-red-600 mt-2">Task ID: {uploadState.analysisTaskId}</p>
                )}
                <button
                  className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                  onClick={() => setUploadState({ type: 'initial' })}
                >
                  Try Again
                </button>
              </div>
            </div>
          );

        case 'deleting':
          return (
            <div className="text-center text-muted-foreground">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
              <p>Deleting file...</p>
            </div>
          );

        default:
          return <GCSVideoUploader onUploadCompleteAction={handleUploadComplete} />;
      }
    };

    return (
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


