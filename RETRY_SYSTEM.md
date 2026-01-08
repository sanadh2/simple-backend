# Retry System for Bookmark AI Tagging

## Overview

The bookmark AI tagging system includes a comprehensive retry mechanism that handles transient failures, permanent failures, and provides manual retry capabilities.

## Features

✅ **Automatic Retries** - Up to 5 attempts with exponential backoff
✅ **Smart Error Classification** - Distinguishes retryable vs permanent failures
✅ **Health Checks** - Verifies Ollama availability before processing
✅ **Manual Retry** - API endpoint to manually retry failed jobs
✅ **Dead Letter Queue** - Permanent failures moved to separate queue
✅ **Fallback Handling** - Sets "uncategorized" tag after permanent failure
✅ **Retry Tracking** - Detailed logging of attempts and failures

## Retry Configuration

### Queue Settings

```typescript
{
  attempts: 5,                    // Maximum retry attempts
  backoff: {
    type: 'exponential',          // Exponential backoff
    delay: 5000,                  // Initial delay: 5 seconds
  }
}
```

### Retry Delays

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1st     | 0s    | Immediate  |
| 2nd     | 5s    | 5s         |
| 3rd     | 10s   | 15s        |
| 4th     | 20s   | 35s        |
| 5th     | 40s   | 75s        |

## Error Classification

### Retryable Errors (Will Retry)

- Network errors (connection refused, timeout)
- Service unavailable (Ollama down)
- Rate limiting
- Empty/invalid responses
- Temporary service issues

**Patterns detected:**
- `network`, `timeout`, `connection`, `econnrefused`, `etimedout`
- `rate limit`, `too many requests`
- `service unavailable`, `bad gateway`, `gateway timeout`
- `no response`, `empty response`

### Permanent Errors (Won't Retry)

- Bookmark not found
- Invalid/malformed data
- Authentication errors
- Syntax errors

**Patterns detected:**
- `not found`, `unauthorized`, `forbidden`
- `invalid`, `malformed`, `syntax error`

## API Endpoints

### Check Job Status

```http
GET /api/bookmarks/jobs/:jobId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "regenerate-123-1234567890",
    "state": "failed",
    "attemptsMade": 3,
    "maxAttempts": 5,
    "remainingAttempts": 2,
    "isRetryable": true,
    "canRetry": true,
    "failedReason": "Ollama service unavailable",
    "result": null
  }
}
```

**States:**
- `waiting` - Job queued, waiting to be processed
- `active` - Currently being processed
- `completed` - Successfully completed
- `failed` - Failed (may be retryable)
- `delayed` - Scheduled for retry

### Manual Retry

```http
POST /api/bookmarks/jobs/:jobId/retry
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "regenerate-123-1234567890",
    "state": "waiting",
    "attemptsMade": 4,
    "maxAttempts": 5
  }
}
```

**Conditions:**
- Job must be in `failed` state
- Must have remaining attempts (`attemptsMade < maxAttempts`)
- Returns 400 if conditions not met

## Worker Logic

### Processing Flow

```
1. Check bookmark exists
   ↓ (if not found → permanent error)
2. Check Ollama health
   ↓ (if unavailable → retryable error, delay 10s)
3. Generate AI tags
   ↓ (if uncategorized → retry if < 3 attempts)
4. Save bookmark
   ↓
5. Success!
```

### Error Handling

```typescript
try {
  // Process bookmark
} catch (error) {
  if (isPermanentError(error)) {
    throw error; // No retry
  }
  
  if (hasRetryAfter(error)) {
    await job.moveToDelayed(retryAfter);
  }
  
  throw error; // Will retry with backoff
}
```

## Dead Letter Queue

Permanent failures are moved to `bookmark-tags-failed` queue:

- **Purpose:** Track and analyze permanent failures
- **Retention:** 30 days
- **Contains:** Job data + error message + retry count

## Monitoring

### Check Queue Status

```typescript
import { bookmarkQueue } from './queues/bookmarkQueue';

const counts = await bookmarkQueue.getJobCounts();
console.log(counts);
// {
//   waiting: 5,
//   active: 2,
//   completed: 1000,
//   failed: 3,
//   delayed: 1
// }
```

### Get Failed Jobs

```typescript
const failedJobs = await bookmarkQueue.getFailed(0, 10);
failedJobs.forEach(job => {
  console.log({
    id: job.id,
    attempts: job.attemptsMade,
    error: job.failedReason,
    data: job.data
  });
});
```

## Best Practices

### 1. Monitor Queue Health

```bash
# Check queue depth
redis-cli LLEN bull:bookmark-tags:wait

# Check failed jobs
redis-cli LLEN bull:bookmark-tags:failed
```

### 2. Handle Permanent Failures

After 5 failed attempts:
- Bookmark is set to `uncategorized` tag
- Job moved to dead letter queue
- User can manually retry or edit tags

### 3. Adjust Retry Settings

For slower models or unreliable networks:

```typescript
// Increase attempts
attempts: 7

// Increase initial delay
backoff: {
  delay: 10000,  // 10 seconds
}
```

### 4. Scale Workers

For high volume:

```typescript
// Increase concurrency
concurrency: 5  // Process 5 jobs simultaneously
```

## Troubleshooting

### Issue: Jobs stuck in "waiting"

**Cause:** Worker not running or Redis connection issue

**Solution:**
1. Check worker is started: `✓ Bookmark worker started`
2. Verify Redis connection
3. Check worker logs for errors

### Issue: All retries failing

**Cause:** Permanent issue (Ollama down, invalid model, etc.)

**Solution:**
1. Check Ollama health: `curl http://localhost:11434/api/tags`
2. Verify model exists: `ollama list`
3. Check error messages in failed jobs
4. Manually retry after fixing issue

### Issue: Too many retries

**Cause:** Transient errors persisting

**Solution:**
1. Check Ollama logs
2. Verify network connectivity
3. Consider increasing delay between retries
4. Check if model is overloaded

## Metrics

Track retry success rate:

```typescript
const completed = await bookmarkQueue.getCompleted(0, 1000);
const failed = await bookmarkQueue.getFailed(0, 1000);

const successRate = completed.length / (completed.length + failed.length);
console.log(`Success rate: ${(successRate * 100).toFixed(2)}%`);
```

## Summary

✅ **5 automatic retries** with exponential backoff
✅ **Smart error classification** (retryable vs permanent)
✅ **Health checks** before processing
✅ **Manual retry API** for failed jobs
✅ **Dead letter queue** for permanent failures
✅ **Automatic fallback** to "uncategorized"
✅ **Comprehensive logging** for debugging

The retry system ensures maximum reliability while preventing infinite retry loops! 🚀

