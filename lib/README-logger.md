# Logger Configuration Examples

## Environment Variables

Add to your `.env.local` file:

```bash
# Control log level (optional - overrides defaults)
# NEXT_PUBLIC_LOG_LEVEL=debug  # Show all logs
# NEXT_PUBLIC_LOG_LEVEL=info   # Show info, warn, error
# NEXT_PUBLIC_LOG_LEVEL=warn   # Show warn, error only (production default)
# NEXT_PUBLIC_LOG_LEVEL=error  # Show errors only
```

## Default Behavior

- **Development** (`NODE_ENV=development`): Shows all logs (debug, info, warn, error)
- **Production** (`NODE_ENV=production`): Shows warnings and errors only
- **Test** (`NODE_ENV=test`): Shows errors only

## Runtime Control (Development Only)

Open browser console and run:

```javascript
// Change log level at runtime
setLogLevel('debug')  // Show all logs
setLogLevel('info')   // Show info+
setLogLevel('warn')   // Show warn+
setLogLevel('error')  // Show errors only

// View stored logs
showLogs()  // Shows table of recent logs

// Clear stored logs
clearLogs()
```

## Integration with Error Tracking

The logger includes a placeholder for error tracking services:

```typescript
// In lib/logger.ts, replace the sendToErrorTracking method:
private sendToErrorTracking(entry: LogEntry) {
  if (entry.level === 'error' || entry.level === 'warn') {
    // Send to Sentry, LogRocket, Bugsnag, etc.
    // Sentry.captureException(entry.data, { tags: { context: entry.context } });
  }
}
```

## Usage Examples

```typescript
import { logger } from '@/lib/logger';

// Debug logging (development only)
logger.debug('User clicked button', { buttonId: 'upload' }, 'UI');

// Info logging
logger.info('File uploaded successfully', { fileName, size }, 'Upload');

// Warning (shows in production)
logger.warn('API response slow', { responseTime: 3000 }, 'API');

// Error (always shows, sent to tracking)
logger.error('Upload failed', error, 'Upload');
```