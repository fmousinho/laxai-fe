"use client";

import { useEffect } from 'react';
import { configureLogger } from '@/lib/logger-config';

export function LoggerInitializer() {
  useEffect(() => {
    configureLogger();
  }, []);

  return null; // This component doesn't render anything
}