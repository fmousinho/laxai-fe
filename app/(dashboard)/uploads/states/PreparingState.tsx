"use client";
import React from 'react';

interface PreparingStateProps {
  uploadState: any;
  setUploadState: React.Dispatch<React.SetStateAction<any>>;
}

export const PreparingState: React.FC<PreparingStateProps> = ({
  uploadState,
  setUploadState,
}) => {
  return (
    <div className="max-w-lg mx-auto mt-16 p-8 border-2 border-dashed rounded-2xl text-center bg-card text-card-foreground shadow-lg font-sans">
      <div className="flex flex-col items-center justify-center gap-2">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-primary">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p className="text-lg font-medium mb-2">Preparing video...</p>
        <div className="w-full mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: '100%' }}
            ></div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Preparing video...</p>
        </div>
        {uploadState.videoFile?.fileName && (
          <div className="mt-4 text-sm text-muted-foreground">Processing: {uploadState.videoFile.fileName}</div>
        )}
      </div>
    </div>
  );
};