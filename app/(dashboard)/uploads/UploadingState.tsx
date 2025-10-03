"use client";
import React, { useCallback, useState } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";

type VideoUploaderProps = {
  onUploadCompleteAction: (signedUrl: string, fileName: string) => void;
  onUploadStartAction?: () => void;
  onUploadErrorAction?: (error: string) => void;
  isPreparing?: boolean;
};

export function GCSVideoUploader({ onUploadCompleteAction, onUploadStartAction, onUploadErrorAction, isPreparing }: VideoUploaderProps) {
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
        if (prev < 90) return Math.round(prev + Math.random() * 10);
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
    onUploadStartAction?.();
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
      // After upload, set video file directly with signedUrl
      onUploadCompleteAction(signedUrl, file.name);
    } catch (error: any) {
      console.error('=== UPLOAD ERROR ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Full error object:', error);
      onUploadErrorAction?.(error.message || 'Upload failed');
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'video/mp4': ['.mp4'] }, multiple: false, disabled: uploading || isPreparing });

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
          {isDragActive ? "Drop the files here ..." : uploading ? "Uploading..." : isPreparing ? "Preparing video..." : "Drag & drop a file here, or click to select"}
        </p>
        {(uploading || isPreparing) && (
          <div className="w-full mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${isPreparing ? 100 : uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{isPreparing ? '' : `${uploadProgress}% complete`}</p>
          </div>
        )}
        {selectedFileName && (
          <div className="mt-4 text-sm text-muted-foreground">Selected: {selectedFileName}</div>
        )}
      </div>
    </div>
  );
}

interface UploadingStateProps {
  onUploadCompleteAction: (signedUrl: string, fileName: string) => void;
  onUploadStartAction: () => void;
  onUploadErrorAction: (error: string) => void;
}

const UploadingState: React.FC<UploadingStateProps> = ({
  onUploadCompleteAction,
  onUploadStartAction,
  onUploadErrorAction,
}) => {
  return (
    <GCSVideoUploader
      onUploadCompleteAction={onUploadCompleteAction}
      onUploadStartAction={onUploadStartAction}
      onUploadErrorAction={onUploadErrorAction}
    />
  );
};

export { UploadingState };