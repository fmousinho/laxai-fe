
"use client";
import React, { useCallback, useState, useEffect } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import { useErrorHandler } from '@/lib/useErrorHandler';
import { ErrorPage } from '@/components/ErrorPage';



// Simple runtime error boundary (client side) to surface errors instead of blank screen
function RuntimeErrorBoundary({ children }: { children: React.ReactNode }) {
  const [err, setErr] = useState<Error | null>(null);
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      setErr(event.error || new Error(event.message));
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);
  if (err) {
    return (
      <div className="p-6 text-red-600 font-mono text-sm space-y-2">
        <h2 className="font-bold">Client Runtime Error</h2>
        <pre className="whitespace-pre-wrap break-all">{err.message}</pre>
        {err.stack && (
          <details open>
            <summary className="cursor-pointer mb-1">Stack trace</summary>
            <pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto">{err.stack}</pre>
          </details>
        )}
        <button
          onClick={() => location.reload()}
          className="px-3 py-1 rounded bg-red-500 text-white text-xs"
        >Reload</button>
      </div>
    );
  }
  return <>{children}</>;
}

export default function Uploads() {
  const [showModal, setShowModal] = useState(false);
  // videoFile: { fileName, signedUrl, folder?, fullPath? } | null
  const [videoFile, setVideoFile] = useState<{ fileName: string; signedUrl: string; folder?: string; fullPath?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ task_id: string; status: string; message: string } | null>(null);
  const [analysisTaskId, setAnalysisTaskId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');

  const { error: apiError, handleFetchError, handleApiError, clearError } = useErrorHandler();

  // Function to start streaming progress updates
  const startProgressStream = (taskId: string) => {
    const eventSource = new EventSource(`/api/track/${taskId}/progress/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different status types
        switch (data.status) {
          case 'waiting':
            setAnalysisProgress(prev => [...prev, data.message || 'Waiting for job to start...']);
            setAnalysisStatus('running'); // Map waiting to running status
            break;
          case 'started':
            setAnalysisProgress(prev => [...prev, data.message || 'Job has started processing...']);
            setAnalysisStatus('running'); // Map started to running status
            break;
          case 'processing':
            const progressMsg = data.progress !== undefined 
              ? `Processing: ${data.progress}% complete`
              : data.message || 'Processing...';
            setAnalysisProgress(prev => [...prev, progressMsg]);
            setAnalysisStatus('running'); // Map processing to running status
            break;
          case 'completed':
            setAnalysisProgress(prev => [...prev, data.message || 'Analysis completed successfully']);
            setAnalysisStatus('completed');
            eventSource.close();
            break;
          case 'failed':
            setAnalysisProgress(prev => [...prev, data.message || 'Analysis failed']);
            setAnalysisStatus('failed');
            eventSource.close();
            break;
          default:
            setAnalysisProgress(prev => [...prev, data.message || data.status || 'Update received']);
        }
      } catch (error) {
        console.error('Error parsing progress data:', error);
        setAnalysisProgress(prev => [...prev, 'Error parsing update']);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setAnalysisProgress(prev => [...prev, 'Connection error - retrying...']);
      setAnalysisStatus('failed');
      eventSource.close();
    };

    // Store eventSource for cleanup if needed
    return eventSource;
  };

  // On mount, fetch from API
  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get('/api/gcs/list_video');
        if (data.files && data.files.length > 0) {
          setVideoFile(data.files[0]);
        } else {
          setVideoFile(null);
        }
      } catch (err) {
        setError('Failed to load video info');
        setVideoFile(null);
      } finally {
        setLoading(false);
      }
    };
    fetchVideo();
  }, []);

  const handleUploadComplete = () => {
    // After upload, refetch video list
    setLoading(true);
    setError(null);
    axios.get('/api/gcs/list_video')
      .then(({ data }) => {
        if (data.files && data.files.length > 0) {
          setVideoFile(data.files[0]);
        } else {
          setVideoFile(null);
        }
      })
      .catch(() => setError('Failed to load video info'))
      .finally(() => setLoading(false));
  };

  const handleDelete = async () => {
    if (!videoFile) return;
    setLoading(true);
    setError(null);
    try {
      // Use fullPath if available, otherwise construct from fileName (assuming raw folder)
      const filePath = videoFile.fullPath || `${videoFile.fileName}`;
      await axios.delete('/api/gcs/delete_video', { data: { fileName: filePath } });
      // After delete, refresh video list
      const { data } = await axios.get('/api/gcs/list_video');
      if (data.files && data.files.length > 0) {
        setVideoFile(data.files[0]);
      } else {
        setVideoFile(null);
      }
    } catch (err) {
      setError('Failed to delete video');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoAnalysis = async () => {
    if (!videoFile) return;

    setAnalyzing(true);
    clearError();
    setAnalysisResult(null);
    setAnalysisProgress([]);
    setAnalysisStatus('running');

    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_filename: videoFile.fileName,
          // Add any other required fields for the tracking request
        }),
      });

      const isOk = await handleFetchError(res, 'handleVideoAnalysis');
      if (!isOk) {
        setAnalyzing(false);
        setAnalysisStatus('failed');
        return;
      }

      const data = await res.json();
      setAnalysisResult(data);
      setAnalysisTaskId(data.task_id);
      // Start streaming progress updates
      startProgressStream(data.task_id);
    } catch (error) {
      console.error('Failed to start video analysis:', error);
      handleApiError(error, 'handleVideoAnalysis');
      setAnalysisStatus('failed');
    }
    setAnalyzing(false);
  };

  const videoUrl = videoFile ? videoFile.signedUrl : null;

  return (
    <RuntimeErrorBoundary>
    <div className="py-8">
      {apiError ? (
        <ErrorPage
          error={apiError}
          onRetry={clearError}
          onDismiss={clearError}
        />
      ) : loading ? (
        <div className="text-center text-muted-foreground">Loading...</div>
      ) : error ? (
        <div className="text-center text-red-500">{error}</div>
      ) : !videoUrl ? (
        <GCSVideoUploader onUploadCompleteAction={handleUploadComplete} />
      ) : (
        <div className="mt-6 text-center flex flex-col items-center gap-4">
          <p className="mb-2 text-lg font-medium">Video uploaded!</p>
          <video
            src={videoUrl}
            controls
            className="mx-auto max-h-64 rounded-lg border bg-black cursor-pointer"
            style={{ maxWidth: 400 }}
            onClick={() => setShowModal(true)}
          />
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowModal(false)}>
              <div className="relative" onClick={e => e.stopPropagation()}>
                <video
                  src={videoUrl}
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
          <div className="text-sm text-muted-foreground">{videoFile?.fileName}</div>

          {analysisStatus === 'running' ? (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
              <h3 className="font-semibold text-blue-800 mb-2">Video Analysis in Progress</h3>
              <div className="bg-white border rounded p-3 max-h-40 overflow-y-auto text-sm">
                {analysisProgress.length === 0 ? (
                  <p className="text-gray-500">Connecting to analysis stream...</p>
                ) : (
                  analysisProgress.map((message, index) => (
                    <p key={index} className="mb-1 text-gray-700">{message}</p>
                  ))
                )}
              </div>
              {analysisTaskId && (
                <p className="text-xs text-blue-600 mt-2">Task ID: {analysisTaskId}</p>
              )}
            </div>
          ) : analysisStatus === 'completed' ? (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg max-w-md mx-auto">
              <h3 className="font-semibold text-green-800">Analysis Completed!</h3>
              <p className="text-sm text-green-700 mt-1">Video analysis has finished successfully.</p>
              {analysisTaskId && (
                <p className="text-xs text-green-600 mt-2">Task ID: {analysisTaskId}</p>
              )}
            </div>
          ) : analysisStatus === 'failed' ? (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <h3 className="font-semibold text-red-800">Analysis Failed</h3>
              <p className="text-sm text-red-700 mt-1">Video analysis encountered an error.</p>
              {analysisTaskId && (
                <p className="text-xs text-red-600 mt-2">Task ID: {analysisTaskId}</p>
              )}
            </div>
          ) : (
            <div className="flex gap-4 mt-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition"
                onClick={handleDelete}
              >
                Delete
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-50"
                onClick={handleVideoAnalysis}
                disabled={analyzing}
              >
                {analyzing ? 'Starting Analysis...' : 'Start Video Analysis'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    </RuntimeErrorBoundary>
  );

}

type VideoUploaderProps = {
  onUploadCompleteAction: () => void;
};

function GCSVideoUploader({ onUploadCompleteAction }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // XMLHttpRequest upload with progress tracking
  const uploadWithXHR = async (signedUrl: string, file: File, startTime: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentCompleted = Math.round((event.loaded / event.total) * 100);
          console.log(`Upload progress: ${percentCompleted}% (${event.loaded}/${event.total} bytes)`);
          setUploadProgress(percentCompleted);
        }
      };
      
      // Handle completion
      xhr.onload = () => {
        const endTime = Date.now();
        console.log(`PUT request completed in ${endTime - startTime}ms`);
        console.log('Response status:', xhr.status);
        console.log('Response statusText:', xhr.statusText);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          console.error('GCS error response:', xhr.responseText);
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };
      
      // Handle errors
      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };
      
      // Handle timeout
      xhr.ontimeout = () => {
        reject(new Error('Upload timeout after 5 minutes'));
      };
      
      // Configure request
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.timeout = 300000; // 5 minutes
      
      // Start upload
      console.log('Starting XMLHttpRequest upload...');
      xhr.send(file);
    });
  };
  
  // Fetch upload for Safari large files (no progress tracking but more stable)
  const uploadWithFetch = async (signedUrl: string, file: File, startTime: number): Promise<void> => {
    console.log('Using fetch upload (Safari large file mode)...');
    
    // Simulate progress for large files in Safari
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev < 90) return prev + Math.random() * 10;
        return prev;
      });
    }, 2000);
    
    try {
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });
      
      clearInterval(progressInterval);
      
      const endTime = Date.now();
      console.log(`PUT request completed in ${endTime - startTime}ms`);
      console.log('Response status:', response.status);
      console.log('Response statusText:', response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('GCS error response body:', errorText);
        throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  };

  // Upload logic
  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    
    // Check if Safari and file is large
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isLargeFile = file.size > 100 * 1024 * 1024; // 100MB
    
    console.log('=== CLIENT UPLOAD START ===');
    console.log('Browser:', isSafari ? 'Safari' : 'Other');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      isLarge: isLargeFile,
      lastModified: new Date(file.lastModified).toISOString()
    });
    
    try {
      console.log('Requesting signed URL...');
      const { data } = await axios.post('/api/gcs/upload_video', {
        fileName: file.name,
        contentType: file.type,
      });
      
      console.log('Signed URL response received:', data);
      
      const { signedUrl } = data;
      if (!signedUrl) {
        throw new Error('No signed URL received from server');
      }
      
      console.log('Full signed URL:', signedUrl);
      console.log('URL hostname:', new URL(signedUrl).hostname);
      console.log('URL pathname:', new URL(signedUrl).pathname);
      
      console.log('Starting PUT request to GCS...');
      console.log('Request headers will be:', { 'Content-Type': file.type });
      
      const startTime = Date.now();
      
      // Use different upload strategy for Safari with large files
      if (isSafari && isLargeFile) {
        console.log('Using Safari-optimized upload strategy...');
        await uploadWithFetch(signedUrl, file, startTime);
      } else {
        console.log('Using XMLHttpRequest upload strategy...');
        await uploadWithXHR(signedUrl, file, startTime);
      }
      
      console.log('=== UPLOAD SUCCESS ===');
      setSelectedFileName(null);
      setUploadProgress(100);
      // After upload, refetch video list and use signedUrl
      onUploadCompleteAction();
    } catch (error: any) {
      console.error('=== UPLOAD ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Full error object:', error);
      alert(`Upload failed: ${error.message || 'Check console for details'}`);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // Dropzone handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type !== 'video/mp4' && !file.name.toLowerCase().endsWith('.mp4')) {
        setSelectedFileName(null);
        alert('Please select an MP4 video file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024 * 1024) { // 10GB
        setSelectedFileName(null);
        alert('File size exceeds 10GB limit.');
        return;
      }
      setSelectedFileName(file.name);
      uploadFile(file);
    } else {
      setSelectedFileName(null);
      alert('Please select an MP4 video file.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'video/mp4': ['.mp4'] }, multiple: false, disabled: uploading });

  return (
    <div
      className={`max-w-lg mx-auto mt-16 p-8 border-2 border-dashed rounded-2xl text-center bg-card text-card-foreground shadow-lg font-sans cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : 'hover:bg-primary/10'}`}
      tabIndex={0}
      {...getRootProps()}
    >
      <input
        {...getInputProps()}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          border: 0,
          opacity: 0
        }}
        // Safari: do not use display: none
        // Do not set disabled here
      />
      <div className="flex flex-col items-center justify-center gap-2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-primary">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p className="text-lg font-medium mb-2">
          {isDragActive ? "Drop the files here ..." : uploading ? `Uploading... ${uploadProgress}%` : "Drag & drop a file here, or click to select"}
        </p>
        {uploading && (
          <div className="w-full mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{uploadProgress}% complete</p>
          </div>
        )}
        {selectedFileName && (
          <div className="mt-4 text-sm text-muted-foreground">Selected: {selectedFileName}</div>
        )}
      </div>
    </div>
  );
}
