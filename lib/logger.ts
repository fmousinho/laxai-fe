"use client";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
  context?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private minLevel: LogLevel = this.isDevelopment ? 'debug' : 'warn';

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const prefix = context ? `[${context}]` : '';
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[level];

    return `${levelEmoji} ${prefix} ${message}`;
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date(),
      context
    };
  }

  debug(message: string, data?: any, context?: string) {
    if (!this.shouldLog('debug')) return;

    const formattedMessage = this.formatMessage('debug', message, context);
    console.debug(formattedMessage, data || '');
  }

  info(message: string, data?: any, context?: string) {
    if (!this.shouldLog('info')) return;

    const formattedMessage = this.formatMessage('info', message, context);
    console.info(formattedMessage, data || '');
  }

  warn(message: string, data?: any, context?: string) {
    if (!this.shouldLog('warn')) return;

    const formattedMessage = this.formatMessage('warn', message, context);
    console.warn(formattedMessage, data || '');

    // In production, you could send warnings to error tracking service
    if (!this.isDevelopment) {
      this.sendToErrorTracking(this.createLogEntry('warn', message, data, context));
    }
  }

  error(message: string, error?: any, context?: string) {
    if (!this.shouldLog('error')) return;

    const formattedMessage = this.formatMessage('error', message, context);
    console.error(formattedMessage, error || '');

    // Always send errors to tracking service in production
    this.sendToErrorTracking(this.createLogEntry('error', message, error, context));
  }

  // Method to send logs to external service (Sentry, LogRocket, etc.)
  private sendToErrorTracking(entry: LogEntry) {
    // Placeholder for error tracking service integration
    // Example: Sentry.captureMessage(entry.message, { level: entry.level, extra: entry.data });

    // For now, just store in localStorage for debugging (remove in production)
    if (this.isDevelopment) {
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      logs.push(entry);
      // Keep only last 50 logs
      if (logs.length > 50) logs.shift();
      localStorage.setItem('app_logs', JSON.stringify(logs));
    }
  }

  // Set minimum log level (useful for runtime configuration)
  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  // Get current logs (for debugging)
  getLogs(): LogEntry[] {
    if (!this.isDevelopment) return [];
    return JSON.parse(localStorage.getItem('app_logs') || '[]');
  }

  // Clear stored logs
  clearLogs() {
    localStorage.removeItem('app_logs');
  }
}

// Create singleton instance
export const logger = new Logger();

// Export types for TypeScript
export type { LogLevel, LogEntry };