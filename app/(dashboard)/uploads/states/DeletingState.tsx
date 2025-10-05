"use client";
import React from 'react';

export const DeletingState: React.FC = () => {
  return (
    <div className="text-center text-muted-foreground">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
      <p>Deleting file...</p>
    </div>
  );
};