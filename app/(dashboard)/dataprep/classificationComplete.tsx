"use client";

import React from "react";
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface ClassificationCompleteProps {
  onBackToList: () => void;
}

export default function ClassificationComplete({ onBackToList }: ClassificationCompleteProps) {
  return (
    <div className="w-full max-w-2xl mx-auto p-8">
      <div className="text-center">
        {/* Success Banner */}
        <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">
            Classification Complete
          </h1>
          <p className="text-green-700">
            The video classification process has been completed successfully.
          </p>
        </div>

        {/* OK Button */}
        <Button
          onClick={onBackToList}
          className="px-8 py-3 text-lg"
        >
          OK
        </Button>
      </div>
    </div>
  );
}
