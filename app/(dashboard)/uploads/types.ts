// Shared types for the uploads page and its components
export type UploadStateType =
  | 'initial'
  | 'uploading'
  | 'preparing'
  | 'ready'
  | 'analysing'
  | 'analysis_complete'
  | 'failed_upload'
  | 'failed_analysis'
  | 'deleting';


export type AnalysingSubstateType = 
  | 'not_started'
  | 'initializing'
  | 'running'
  | 'completed'
  | 'error'
  | 'failed'
  | 'cancelled'


export interface VideoFile {
  fileName: string;
  fullPath?: string;
  signedUrl?: string;
  size?: number;
  created?: string;
}

export interface AnalysisRunningData {
  total_frames?: number;
  processed_frames: number;
}

export interface UploadingState {
  type: 'uploading';
  videoFile?: VideoFile;
  uploadProgress: number;
}


export type UploadState =
  | { type: 'initial' }
  | UploadingState
  | { type: 'preparing'; videoFile: VideoFile }
  | { type: 'ready'; videoFile: VideoFile }
  | { type: 'analysing'; videoFile: VideoFile; analysisTaskId: string }
  | { type: 'analysis_complete'; videoFile: VideoFile; analysisTaskId: string }
  | { type: 'failed_upload'; videoFile?: VideoFile; error: string }
  | { type: 'failed_analysis'; videoFile: VideoFile; error: string; analysisTaskId: string }
  | { type: 'deleting'; videoFile: VideoFile };