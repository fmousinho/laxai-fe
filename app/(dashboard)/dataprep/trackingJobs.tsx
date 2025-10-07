"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';

interface TrackingJob {
  task_id: string;
  status: string;
  [key: string]: any;
}

interface TrackingJobsResponse {
  jobs: TrackingJob[];
  count: number;
}

export function TrackingJobsList() {
  const [jobs, setJobs] = useState<TrackingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackingJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tracking-jobs?limit=50');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TrackingJobsResponse = await response.json();
      setJobs(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tracking jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingJobs();
  }, []);

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'default';
      case 'running':
      case 'in_progress':
        return 'secondary';
      case 'failed':
      case 'error':
        return 'destructive';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Tracking Jobs</h2>
        <Button
          onClick={fetchTrackingJobs}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {jobs.length === 0 && !loading && !error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No tracking jobs found.</p>
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.task_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Task ID: {job.task_id}</CardTitle>
                  <Badge variant={getStatusBadgeVariant(job.status)}>
                    {job.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(job).map(([key, value]) => {
                    if (key === 'task_id' || key === 'status') return null;
                    return (
                      <div key={key}>
                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                        <span className="text-muted-foreground">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}