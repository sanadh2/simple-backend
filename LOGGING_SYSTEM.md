# Database Logging System

## Overview

All logs are now stored in MongoDB in addition to being printed to console. This allows you to:
- Query logs by various filters
- Track requests across the system using correlation IDs
- Analyze errors and trends
- Debug production issues

---

## Log Schema

Each log entry contains:
- `timestamp` - When the log was created
- `level` - Log level (info, warn, error, debug)
- `correlationId` - Unique ID to trace a request
- `message` - Log message
- `userId` - User who triggered the action (if authenticated)
- `meta` - Additional metadata (errors, request info, etc.)

---

## Features

### 1. Automatic Storage
All logs are automatically saved to the database when you use the logger:

```typescript
import { logger } from './utils/logger';

logger.info('User logged in', { email: 'user@example.com' });
logger.warn('Invalid password attempt', { email: 'user@example.com' });
logger.error('Database connection failed', error, { dbHost: 'localhost' });
```

### 2. Capped Collection
The logs collection is **capped** at:
- **50 MB** maximum size
- **100,000** maximum documents

This prevents the database from growing indefinitely. Old logs are automatically removed.

### 3. Indexed Fields
The following fields are indexed for fast queries:
- `timestamp`
- `level`
- `correlationId`
- `userId`
- Combined indexes for common query patterns

---

## API Endpoints

### 1. Get Logs (Paginated & Filtered)

**Endpoint:** `GET /api/logs`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)
- `level` - Filter by level (info, warn, error, debug)
- `correlationId` - Filter by correlation ID
- `userId` - Filter by user ID
- `message` - Search in message (case-insensitive)
- `startDate` - Filter from date (ISO format)
- `endDate` - Filter to date (ISO format)

**Example:**
```bash
# Get all error logs
curl -X GET "http://localhost:3000/api/logs?level=error&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get logs for a specific user
curl -X GET "http://localhost:3000/api/logs?userId=123&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get logs in a date range
curl -X GET "http://localhost:3000/api/logs?startDate=2026-01-01&endDate=2026-01-07" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search logs by message
curl -X GET "http://localhost:3000/api/logs?message=login" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Logs retrieved successfully",
  "data": {
    "logs": [
      {
        "timestamp": "2026-01-07T05:09:24.677Z",
        "level": "error",
        "correlationId": "f4565262-b4fe-4aa2-9bc5-ce62c5bea98a",
        "message": "Internal Server Error",
        "userId": "695cfe567c6ada29b8547e1c",
        "meta": {
          "error": {
            "message": "Something went wrong",
            "stack": "..."
          }
        }
      }
    ],
    "totalCount": 150,
    "currentPage": 1,
    "pageSize": 50,
    "totalPages": 3
  }
}
```

---

### 2. Get Logs by Correlation ID

**Endpoint:** `GET /api/logs/correlation/:correlationId`

**Purpose:** Trace an entire request through the system

**Example:**
```bash
curl -X GET "http://localhost:3000/api/logs/correlation/f4565262-b4fe-4aa2-9bc5-ce62c5bea98a" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Logs retrieved successfully",
  "data": [
    {
      "timestamp": "2026-01-07T05:09:24.639Z",
      "level": "info",
      "correlationId": "f4565262-b4fe-4aa2-9bc5-ce62c5bea98a",
      "message": "Fetching user statistics",
      "userId": "695cfe567c6ada29b8547e1c"
    },
    {
      "timestamp": "2026-01-07T05:09:24.677Z",
      "level": "error",
      "correlationId": "f4565262-b4fe-4aa2-9bc5-ce62c5bea98a",
      "message": "Internal Server Error",
      "userId": "695cfe567c6ada29b8547e1c",
      "meta": { /* error details */ }
    }
  ]
}
```

---

### 3. Get Log Statistics

**Endpoint:** `GET /api/logs/statistics`

**Purpose:** Get overview of log distribution by level

**Example:**
```bash
curl -X GET "http://localhost:3000/api/logs/statistics" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Log statistics retrieved successfully",
  "data": {
    "totalLogs": 5234,
    "levelBreakdown": [
      { "level": "info", "count": 4500 },
      { "level": "warn", "count": 500 },
      { "level": "error", "count": 234 }
    ]
  }
}
```

---

### 4. Get Recent Errors

**Endpoint:** `GET /api/logs/errors?limit=20`

**Purpose:** Quick access to recent errors for monitoring

**Example:**
```bash
curl -X GET "http://localhost:3000/api/logs/errors?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Recent errors retrieved successfully",
  "data": [
    {
      "timestamp": "2026-01-07T05:09:24.677Z",
      "level": "error",
      "correlationId": "f4565262-b4fe-4aa2-9bc5-ce62c5bea98a",
      "message": "Internal Server Error",
      "meta": { /* error details */ }
    }
  ]
}
```

---

### 5. Get Log Trends

**Endpoint:** `GET /api/logs/trends?days=7`

**Purpose:** Visualize log patterns over time

**Example:**
```bash
curl -X GET "http://localhost:3000/api/logs/trends?days=7" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Log trends retrieved successfully",
  "data": [
    {
      "date": "2026-01-07",
      "totalCount": 542,
      "levels": [
        { "level": "info", "count": 450 },
        { "level": "warn", "count": 60 },
        { "level": "error", "count": 32 }
      ]
    },
    {
      "date": "2026-01-06",
      "totalCount": 498,
      "levels": [
        { "level": "info", "count": 420 },
        { "level": "warn", "count": 55 },
        { "level": "error", "count": 23 }
      ]
    }
  ]
}
```

---

### 6. Clear Old Logs

**Endpoint:** `DELETE /api/logs/clear?days=30`

**Purpose:** Remove logs older than specified days

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/logs/clear?days=60" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Cleared logs older than 60 days",
  "data": {
    "deletedCount": 1523,
    "cutoffDate": "2025-11-08T00:00:00.000Z"
  }
}
```

---

## Use Cases

### 1. Debug a Failed Request
When a user reports an error with correlation ID `abc123`:

```bash
# Get all logs for this request
curl -X GET "http://localhost:3000/api/logs/correlation/abc123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

You'll see the entire request flow with timestamps.

---

### 2. Monitor Recent Errors

```bash
# Get last 20 errors
curl -X GET "http://localhost:3000/api/logs/errors?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. Audit User Activity

```bash
# Get all actions by a specific user
curl -X GET "http://localhost:3000/api/logs?userId=USER_ID&limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Analyze Error Patterns

```bash
# Get error trends over last 30 days
curl -X GET "http://localhost:3000/api/logs/trends?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.data[] | select(.levels[].level == "error")'
```

---

### 5. Search for Specific Issues

```bash
# Find all MongoDB connection errors
curl -X GET "http://localhost:3000/api/logs?level=error&message=MongoDB" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## MongoDB Queries (Direct)

If you need to query logs directly in MongoDB:

```javascript
// Get all errors in last hour
db.logs.find({
  level: "error",
  timestamp: { $gte: new Date(Date.now() - 60*60*1000) }
}).sort({ timestamp: -1 });

// Count logs by level
db.logs.aggregate([
  { $group: { _id: "$level", count: { $sum: 1 } } }
]);

// Find all logs for a user
db.logs.find({ userId: "USER_ID" }).sort({ timestamp: -1 });

// Find logs with specific error message
db.logs.find({
  level: "error",
  "meta.error.message": /MongoDB/i
});
```

---

## Performance Considerations

### Indexes
The following indexes are automatically created:
- `timestamp` (descending)
- `level` + `timestamp` (compound)
- `correlationId` + `timestamp` (compound)
- `userId`

### Capped Collection
- Automatically removes old logs when limits are reached
- No need for manual cleanup (but API is provided)
- Ensures consistent query performance

### Best Practices
1. **Filter by date range** when querying large datasets
2. **Use correlation ID** for request tracing
3. **Monitor error logs** regularly
4. **Clear old logs** periodically if needed (done automatically with capped collection)

---

## Integration with Monitoring Tools

You can easily integrate with monitoring tools:

### 1. Prometheus/Grafana
Create an endpoint that exposes log metrics:
```typescript
app.get('/metrics/logs', async (req, res) => {
  const stats = await LogService.getLogStatistics();
  // Convert to Prometheus format
});
```

### 2. DataDog/New Relic
Stream logs to external services:
```typescript
// In logger.ts, add third-party integration
if (process.env.DATADOG_API_KEY) {
  // Send to DataDog
}
```

### 3. Slack Alerts
Alert on critical errors:
```typescript
// In logger.ts
if (level === 'error' && meta?.statusCode >= 500) {
  await sendSlackAlert(message, meta);
}
```

---

## Troubleshooting

### Logs not appearing in database
1. Check MongoDB connection
2. Verify Log model is imported in `index.ts`
3. Check for database write errors in console

### Too many logs
1. Increase capped collection size in `Log.ts`
2. Adjust log level (reduce debug logs in production)
3. Clear old logs: `DELETE /api/logs/clear?days=7`

### Slow log queries
1. Ensure indexes are created: `db.logs.getIndexes()`
2. Always filter by date range for large datasets
3. Use pagination with reasonable limits

---

## Summary

You now have a complete logging system that:
- ✅ Stores all logs in MongoDB
- ✅ Provides REST API to query logs
- ✅ Supports filtering, pagination, and search
- ✅ Tracks requests with correlation IDs
- ✅ Automatically manages storage with capped collections
- ✅ Includes error monitoring and trends

Happy logging! 🚀

