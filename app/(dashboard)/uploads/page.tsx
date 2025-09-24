"use client";
import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function Uploads() {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Dummy handler: just log the files
    console.log("Files uploaded:", acceptedFiles);
    alert(`Uploaded: ${acceptedFiles.map(f => f.name).join(", ")}`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div
      className="max-w-lg mx-auto mt-16 p-8 border-2 border-dashed rounded-2xl text-center bg-card text-card-foreground shadow-lg font-sans"
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-primary">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p className="text-lg font-medium mb-2">
          {isDragActive ? "Drop the files here ..." : "Drag & drop a file here, or click to select"}
        </p>
        <button
          type="button"
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold transition-colors hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Browse files
        </button>
      </div>
    </div>
  );
}
