"use client";
import React from 'react';
import { UploadComponent } from '../UploadComponent';

interface InitialStateProps {
  uploadState: any;
  setUploadState: React.Dispatch<React.SetStateAction<any>>;
  onUploadComplete: (signedUrl: string, fileName: string) => void;
  onUploadStart: () => void;
  onUploadError: (error: string) => void;
}

export function InitialState({ uploadState, setUploadState, onUploadComplete, onUploadStart, onUploadError }: InitialStateProps) {
  return (
    <UploadComponent
      uploadState={uploadState}
      setUploadState={setUploadState}
    />
  );
}