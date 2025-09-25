
"use client";
import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";


type UploaderProps = {
  onUploadCompleteAction: (url: string) => void;
};

export default function Uploads() {
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // On mount, load from localStorage if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = localStorage.getItem('uploadedVideoUrl');
      const name = localStorage.getItem('uploadedVideoFileName');
      if (url && name) {
        setUploadedUrl(url);
        setUploadedFileName(name);
      }
    }
  }, []);

  const handleUploadComplete = (url: string, fileName: string) => {
    setUploadedUrl(url);
    setUploadedFileName(fileName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('uploadedVideoUrl', url);
      localStorage.setItem('uploadedVideoFileName', fileName);
    }
  };

  const handleDelete = () => {
    setUploadedUrl(null);
    setUploadedFileName(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('uploadedVideoUrl');
      localStorage.removeItem('uploadedVideoFileName');
    }
  };

  return (
    <div className="py-8">
      {!uploadedUrl ? (
        <GCSVideoUploader onUploadCompleteAction={handleUploadComplete} />
      ) : (
        <div className="mt-6 text-center flex flex-col items-center gap-4">
          <p className="mb-2 text-lg font-medium">Video uploaded!</p>
          <video src={uploadedUrl} controls className="mx-auto max-h-64 rounded-lg border bg-black" style={{ maxWidth: 400 }} />
          <div className="text-sm text-muted-foreground">{uploadedFileName}</div>
          <div className="flex gap-4 mt-2">
            <button
              className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition"
              onClick={handleDelete}
            >
              Delete
            </button>
            <button
              className="px-4 py-2 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
              onClick={handleDelete}
            >
              Replace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type VideoUploaderProps = {
  onUploadCompleteAction: (url: string, fileName: string) => void;
};

function GCSVideoUploader({ onUploadCompleteAction }: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Upload logic
  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await axios.post('/api/gcs-upload', {
        fileName: file.name,
        contentType: file.type,
      });
      const { signedUrl, objectName } = data;
      await axios.put(signedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
      });
  setSelectedFileName(null);
  const publicUrl = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_GCS_BUCKET_NAME}/${objectName}`;
  onUploadCompleteAction(publicUrl, file.name);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Check console.');
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
          {isDragActive ? "Drop the files here ..." : uploading ? "Uploading..." : "Drag & drop a file here, or click to select"}
        </p>
        {selectedFileName && (
          <div className="mt-4 text-sm text-muted-foreground">Selected: {selectedFileName}</div>
        )}
      </div>
    </div>
  );
}
