"use client";
import React from 'react';
import { UploadComponent } from '../UploadComponent';

interface UploadingStateProps {
  uploadState: any;
  setUploadState: React.Dispatch<React.SetStateAction<any>>;
  onUploadCompleteAction: (signedUrl: string, fileName: string) => void;
  onUploadStartAction: () => void;
  onUploadErrorAction: (error: string) => void;
}

const UploadingState: React.FC<UploadingStateProps> = ({
  uploadState,
  setUploadState,
  onUploadCompleteAction,
  onUploadStartAction,
  onUploadErrorAction,
}) => {
  return (
    <UploadComponent
      uploadState={uploadState}
      setUploadState={setUploadState}
    />
  );
};

export { UploadingState };