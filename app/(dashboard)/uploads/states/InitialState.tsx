"use client";
import React from 'react';
import { UploadComponent } from '../UploadComponent';
import { UploadState } from '../types';

interface InitialStateProps {
  uploadState: UploadState;
  setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;
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