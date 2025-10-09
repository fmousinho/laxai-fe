// lib/logger-config.ts
import { logger } from './logger';

// Configure logger based on environment
export function configureLogger() {
  // Development: Show all logs
  if (process.env.NODE_ENV === 'development') {
    logger.setMinLevel('debug');
    console.log('🔧 Logger configured for DEVELOPMENT (all logs enabled)');
  }

  // Production: Only show warnings and errors
  else if (process.env.NODE_ENV === 'production') {
    logger.setMinLevel('warn');
    console.log('🏭 Logger configured for PRODUCTION (warnings+ only)');
  }

  // Test: Show only errors
  else if (process.env.NODE_ENV === 'test') {
    logger.setMinLevel('error');
  }

  // You can also configure based on custom environment variables
  if (process.env.NEXT_PUBLIC_LOG_LEVEL) {
    logger.setMinLevel(process.env.NEXT_PUBLIC_LOG_LEVEL as any);
  }
}

// Runtime log level control (can be called from browser console)
if (typeof window !== 'undefined') {
  (window as any).setLogLevel = (level: 'debug' | 'info' | 'warn' | 'error') => {
    logger.setMinLevel(level);
    console.log(`🔧 Log level set to: ${level}`);
  };

  (window as any).showLogs = () => {
    const logs = logger.getLogs();
    console.table(logs);
  };

  (window as any).clearLogs = () => {
    logger.clearLogs();
    console.log('🗑️ Logs cleared');
  };
}