"use client";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";


import { useState } from "react";
import axios from "axios";


type UploaderProps = {
  onUploadCompleteAction: (url: string) => void;
};

export default function Uploads() {
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  return (
    <div className="py-8">
      <GCSImageUploader onUploadCompleteAction={setUploadedUrl} />
      {uploadedUrl && (
        <div className="mt-6 text-center">
          <p className="mb-2">Image uploaded!</p>
          <img src={uploadedUrl} alt="Uploaded" className="mx-auto max-h-64 rounded-lg border" />
        </div>
      )}
    </div>
  );
}

function GCSImageUploader({ onUploadCompleteAction }: UploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // 1. Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
    } else {
      setFile(null);
      alert('Please select an image file (jpg, png, gif, etc.).');
    }
  };

  // 2. Main upload logic
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      // A. Request the signed URL from the Next.js API route
      const { data } = await axios.post('/api/gcs-upload', {
        fileName: file.name,
        contentType: file.type,
      });

      const { signedUrl, objectName } = data;

      // B. Directly upload the file using HTTP PUT to the GCS signed URL
      await axios.put(signedUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
      });

      // C. Success
      alert('Image upload successful!');
      setFile(null);

      // Construct the final public URL (assuming public read is enabled for the bucket)
      const publicUrl = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_GCS_BUCKET_NAME}/${objectName}`;
      onUploadCompleteAction(publicUrl);

    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Check console.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-16 p-8 border-2 border-dashed rounded-2xl text-center bg-card text-card-foreground shadow-lg font-sans">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="mb-4"
        disabled={uploading}
      />
      <button
        type="button"
        className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold transition-colors hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary"
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? 'Uploading...' : 'Upload Image'}
      </button>
      {file && (
        <div className="mt-4 text-sm text-muted-foreground">Selected: {file.name}</div>
      )}
    </div>
  );
}
