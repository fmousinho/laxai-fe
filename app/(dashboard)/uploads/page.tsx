
"use client";
import React, { useCallback, useState, useEffect } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import { useErrorHandler } from '@/lib/useErrorHandler';
import { ErrorPage } from '@/components/ErrorPage';



export default function Uploads() {
  const [showModal, setShowModal] = useState(false);
  // videoFile: { fileName, signedUrl } | null
  const [videoFile, setVideoFile] = useState<{ fileName: string; signedUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ task_id: string; status: string; message: string } | null>(null);

  const { error: apiError, handleFetchError, handleApiError, clearError } = useErrorHandler();

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
      await axios.delete('/api/gcs/delete_video', { data: { fileName: videoFile.fileName } });
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
        return;
      }

      const data = await res.json();
      setAnalysisResult(data);
    } catch (error) {
      console.error('Failed to start video analysis:', error);
      handleApiError(error, 'handleVideoAnalysis');
    }
    setAnalyzing(false);
  };

  const videoUrl = videoFile ? videoFile.signedUrl : null;

  return (
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

          {analysisResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800">Analysis Started!</h3>
              <p className="text-sm text-green-700 mt-1">{analysisResult.message}</p>
              <p className="text-xs text-green-600 mt-2">Task ID: {analysisResult.task_id}</p>
              <p className="text-xs text-green-600">Status: {analysisResult.status}</p>
            </div>
          )}

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
        </div>
      )}
    </div>
  );

}

type VideoUploaderProps = {
  onUploadCompleteAction: () => void;
};

function GCSVideoUploader({ onUploadCompleteAction }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Upload logic
  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const { data } = await axios.post('/api/gcs/upload_video', {
        fileName: file.name,
        contentType: file.type,
      });
      const { signedUrl } = data;
      await axios.put(signedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });
      setSelectedFileName(null);
      setUploadProgress(0);
      // After upload, refetch video list and use signedUrl
      onUploadCompleteAction();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Check console.');
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
