"use client";
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";

interface UploadComponentProps {
  uploadState: any; // We'll type this properly
  setUploadState: React.Dispatch<React.SetStateAction<any>>;
}

export function UploadComponent({ uploadState, setUploadState }: UploadComponentProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Helper to update both local state and the shared uploadState so the progress
  // bar in parent components always reflects bytes-uploaded progress.
  // Accepts optional loaded/total to expose byte counts as well.
  const updateProgress = (percent: number, loaded?: number | null, total?: number | null) => {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    // Update parent state with progress
    setUploadState((prev: any) => ({
      ...(prev || {}),
      uploadProgress: clamped,
      videoFile: {
        ...(prev?.videoFile || {}),
        progress: clamped,
        bytesUploaded: loaded ?? prev?.videoFile?.bytesUploaded ?? null,
        bytesTotal: total ?? prev?.videoFile?.bytesTotal ?? null,
      }
    }));
  };

  // (Debugging hooks removed) progress updates are handled by updateProgress.

  // XMLHttpRequest upload with progress tracking
  const uploadWithXHR = async (signedUrl: string, file: File, startTime: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        let percentCompleted: number;
        const total = event.lengthComputable ? event.total : file.size;
        if (event.lengthComputable && event.total) {
          percentCompleted = Math.round((event.loaded / event.total) * 100);
        } else {
          // Fallback: estimate progress based on loaded bytes
          percentCompleted = Math.min(95, Math.round(event.loaded / (file.size / 100)));
        }
        updateProgress(percentCompleted, event.loaded, total);
      };

      // Handle completion
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
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
      xhr.send(file);
    });
  };

  // Fetch upload for Safari large files (no progress tracking but more stable)
  const uploadWithFetch = async (signedUrl: string, file: File, startTime: number): Promise<void> => {
    // Simulate progress for large files in Safari
    const progressInterval = setInterval(() => {
      setUploadState((prev: any) => {
        const currentProgress = prev?.uploadProgress || 0;
        if (currentProgress < 90) {
          const newProgress = Math.round(currentProgress + Math.random() * 10);
          return {
            ...prev,
            uploadProgress: newProgress,
            videoFile: {
              ...(prev?.videoFile || {}),
              progress: newProgress,
            }
          };
        }
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
      }
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  };

  // Axios upload with progress tracking
  const uploadWithAxios = async (signedUrl: string, file: File, startTime: number): Promise<void> => {
    await axios.put(signedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        let percentCompleted: number;
        const total = progressEvent.total && progressEvent.total > 0 ? progressEvent.total : file.size;
        if (progressEvent.total && progressEvent.total > 0) {
          percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        } else {
          // Fallback: estimate progress based on loaded bytes (rough approximation)
          percentCompleted = Math.min(95, Math.round(progressEvent.loaded / (file.size / 100)));
        }
        updateProgress(percentCompleted, progressEvent.loaded, total);
      },
      timeout: 300000, // 5 minutes
    });

    // finished
  };

  // Upload logic
  const uploadFile = async (file: File) => {
  setUploading(true);
    // Check if Safari and file is large
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isLargeFile = file.size > 100 * 1024 * 1024; // 100MB

    try {
      const { data } = await axios.post('/api/gcs/upload_video', {
        fileName: file.name,
        contentType: file.type,
      });
      const { signedUrl } = data;
      if (!signedUrl) throw new Error('No signed URL received from server');
      const startTime = Date.now();

      // Use different upload strategy for Safari with large files
      if (isSafari && isLargeFile) {
        await uploadWithFetch(signedUrl, file, startTime);
      } else {
        await uploadWithXHR(signedUrl, file, startTime);
      }
      setSelectedFileName(null);

      // After upload, we need a read-signed URL. The `signedUrl` we used for PUT
      // is an upload URL and may return 400 for GET/HEAD. Ask the backend for
      // the read signed URL via the list endpoint and retry a few times.
      setUploadState((prev: any) => ({ ...(prev || {}), type: 'preparing' }));

      const findReadSignedUrl = async (): Promise<string | null> => {
        try {
          const { data: listData } = await axios.get('/api/gcs/list_video?folder=raw');
          const uploadedFile = listData.files?.find((f: any) => f.fileName === file.name || (f.fullPath || '').endsWith(file.name));
          if (uploadedFile && uploadedFile.signedUrl) return uploadedFile.signedUrl;
        } catch (e) {
          // ignore transient errors
        }
        return null;
      };

      const maxAttempts = 20;
      let attempts = 0;
      let readSignedUrl: string | null = null;

      while (attempts < maxAttempts && !readSignedUrl) {
        attempts++;
        readSignedUrl = await findReadSignedUrl();
        if (!readSignedUrl) await new Promise(res => setTimeout(res, 500));
      }

      if (!readSignedUrl) {
        // Couldn't find a read URL in time — still transition to preparing and
        // let server-side processes handle availability.
        setUploadState((prev: any) => ({ ...(prev || {}), type: 'preparing' }));
      } else {
        // Set the read-signed URL and then poll it until HEAD succeeds (file available)
        setUploadState((prev: any) => ({
          ...(prev || {}),
          type: 'preparing',
          videoFile: {
            fileName: file.name,
            signedUrl: readSignedUrl,
            fullPath: file.name
          }
        }));

        const checkVideoReady = async (): Promise<boolean> => {
          try {
            const response = await fetch(readSignedUrl!, { method: 'HEAD' });
            return response.ok;
          } catch (error) {
            return false;
          }
        };

        attempts = 0;
        const pollForVideo = async (): Promise<void> => {
          attempts++;
          const isReady = await checkVideoReady();

          if (isReady) {
            setUploadState((prev: any) => {
              if (prev.type === 'preparing') {
                return { ...prev, type: 'ready' };
              }
              return prev;
            });
          } else if (attempts < maxAttempts) {
            setTimeout(pollForVideo, 500);
          } else {
            setUploadState((prev: any) => {
              if (prev.type === 'preparing') {
                return { ...prev, type: 'ready' };
              }
              return prev;
            });
          }
        };

        setTimeout(pollForVideo, 500);
      }
    } catch (error: any) {
      const errorMsg = (error && (error.message || (error.response && error.response.data) || String(error))) || 'Upload failed';
      setUploadState({ type: 'failed_upload', error: errorMsg });
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

      // Transition to uploading state immediately when file is selected
      setUploadState({ type: 'uploading', uploadProgress: 0 });
      uploadFile(file);
    } else {
      setSelectedFileName(null);
      alert('Please select an MP4 video file.');
    }
  }, [setUploadState]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/mp4': ['.mp4'] },
    multiple: false,
    disabled: uploading || uploadState.type === 'preparing'
  });

  const isUploadingState = uploadState.type === 'uploading';
  const isPreparing = uploadState.type === 'preparing';

  // Use local uploadProgress as the immediate source for the UI bar. Parent
  // `uploadState` is still updated by updateProgress but using local state
  // ensures the component responds immediately to progress callbacks.

  return (
    <div
      className={`max-w-lg mx-auto mt-16 p-8 border-2 border-dashed rounded-2xl text-center bg-card text-card-foreground shadow-lg font-sans cursor-pointer transition-colors ${uploading || isPreparing ? 'opacity-60 pointer-events-none' : 'hover:bg-primary/10'}`}
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
          {isDragActive ? "Drop the files here ..." :
           isUploadingState ? "Uploading..." :
           isPreparing ? "Preparing video..." :
           "Drag & drop a file here, or click to select"}
        </p>
        {isUploadingState && ( // Show progress bar only in uploading state
          <div className="w-full mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${isPreparing ? 100 : (uploadState.uploadProgress || 0)}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isPreparing ? 'Preparing video...' : `${uploadState.uploadProgress || 0}% complete`}
            </p>
          </div>
        )}
        {selectedFileName && (
          <div className="mt-4 text-sm text-muted-foreground">Selected: {selectedFileName}</div>
        )}
      </div>
    </div>
  );
}