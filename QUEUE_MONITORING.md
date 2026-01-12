# Queue Monitoring Guide

## View Failed and Completed Jobs

### API Endpoints

#### 1. **Get Queue Statistics**

```http
GET /api/bookmarks/jobs/stats
Authorization: Bearer YOUR_TOKEN
```

**Response:**

```json
{
	"success": true,
	"data": {
		"waiting": 5,
		"active": 2,
		"completed": 1250,
		"failed": 8,
		"delayed": 1,
		"total": 1266
	}
}
```

#### 2. **Get Failed Jobs**

```http
GET /api/bookmarks/jobs/failed?start=0&limit=20
Authorization: Bearer YOUR_TOKEN
```

**Query Parameters:**

- `start` - Pagination offset (default: 0)
- `limit` - Number of jobs to return (default: 20, max: 100)

**Response:**

```json
{
	"success": true,
	"data": {
		"jobs": [
			{
				"jobId": "regenerate-123-1234567890",
				"bookmarkId": "695e2aa06941d3c53088f9d2",
				"attemptsMade": 5,
				"maxAttempts": 5,
				"failedReason": "Ollama service unavailable",
				"failedAt": "2024-01-07T10:35:58.537Z",
				"createdAt": "2024-01-07T10:30:00.000Z",
				"state": "failed"
			}
		],
		"pagination": {
			"start": 0,
			"limit": 20,
			"total": 8,
			"hasMore": false
		}
	}
}
```

#### 3. **Get Completed Jobs**

```http
GET /api/bookmarks/jobs/completed?start=0&limit=20
Authorization: Bearer YOUR_TOKEN
```

**Response:**

```json
{
	"success": true,
	"data": {
		"jobs": [
			{
				"jobId": "bookmark-123",
				"bookmarkId": "695e2aa06941d3c53088f9d2",
				"result": {
					"bookmarkId": "695e2aa06941d3c53088f9d2",
					"tags": ["javascript", "react", "frontend"],
					"summary": "React documentation",
					"attempts": 1
				},
				"completedAt": "2024-01-07T10:35:58.537Z",
				"createdAt": "2024-01-07T10:35:00.000Z",
				"processedIn": 58347,
				"state": "completed"
			}
		],
		"pagination": {
			"start": 0,
			"limit": 20,
			"total": 1250,
			"hasMore": true
		}
	}
}
```

#### 4. **Get Specific Job Status**

```http
GET /api/bookmarks/jobs/:jobId
Authorization: Bearer YOUR_TOKEN
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

## Using cURL

### Get Queue Stats

```bash
curl http://localhost:3000/api/bookmarks/jobs/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Failed Jobs

```bash
curl "http://localhost:3000/api/bookmarks/jobs/failed?start=0&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Completed Jobs

```bash
curl "http://localhost:3000/api/bookmarks/jobs/completed?start=0&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Job Status

```bash
curl http://localhost:3000/api/bookmarks/jobs/job-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Using Redis CLI

### Check Queue Counts

```bash
redis-cli

# Waiting jobs
LLEN bull:bookmark-tags:wait

# Active jobs
LLEN bull:bookmark-tags:active

# Completed jobs
LLEN bull:bookmark-tags:completed

# Failed jobs
LLEN bull:bookmark-tags:failed

# Delayed jobs
LLEN bull:bookmark-tags:delayed
```

### View Job Details

```bash
# Get a failed job ID
LRANGE bull:bookmark-tags:failed 0 0

# Get job data (replace JOB_ID)
HGETALL bull:bookmark-tags:JOB_ID
```

## Using Code (TypeScript)

### Get Queue Statistics

```typescript
import { bookmarkQueue } from "./queues/bookmarkQueue"

const counts = await bookmarkQueue.getJobCounts()
console.log("Queue Stats:", counts)
// {
//   waiting: 5,
//   active: 2,
//   completed: 1250,
//   failed: 8,
//   delayed: 1
// }
```

### Get Failed Jobs

```typescript
import { bookmarkQueue } from "./queues/bookmarkQueue"

const failedJobs = await bookmarkQueue.getFailed(0, 20)

for (const job of failedJobs) {
	console.log({
		id: job.id,
		bookmarkId: job.data.bookmarkId,
		attempts: job.attemptsMade,
		error: job.failedReason,
		failedAt: job.finishedOn,
	})
}
```

### Get Completed Jobs

```typescript
import { bookmarkQueue } from "./queues/bookmarkQueue"

const completedJobs = await bookmarkQueue.getCompleted(0, 20)

for (const job of completedJobs) {
	console.log({
		id: job.id,
		bookmarkId: job.data.bookmarkId,
		result: job.returnvalue,
		completedAt: job.finishedOn,
		processedIn:
			job.finishedOn && job.processedOn
				? job.finishedOn - job.processedOn
				: null,
	})
}
```

### Get All Job States

```typescript
import { bookmarkQueue } from "./queues/bookmarkQueue"

const waiting = await bookmarkQueue.getWaiting(0, 10)
const active = await bookmarkQueue.getActive(0, 10)
const completed = await bookmarkQueue.getCompleted(0, 10)
const failed = await bookmarkQueue.getFailed(0, 10)
const delayed = await bookmarkQueue.getDelayed(0, 10)

console.log({
	waiting: waiting.length,
	active: active.length,
	completed: completed.length,
	failed: failed.length,
	delayed: delayed.length,
})
```

## Monitoring Dashboard (Optional)

### Install BullBoard

```bash
npm install @bull-board/api @bull-board/express
```

### Add to Server

```typescript
import { createBullBoard } from "@bull-board/api"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { ExpressAdapter } from "@bull-board/express"
import { bookmarkQueue } from "./queues/bookmarkQueue.js"

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath("/admin/queues")

createBullBoard({
	queues: [new BullMQAdapter(bookmarkQueue)],
	serverAdapter,
})

app.use("/admin/queues", serverAdapter.getRouter())
```

Access at: `http://localhost:3000/admin/queues`

## Quick Reference

| Endpoint                           | Method | Description                 |
| ---------------------------------- | ------ | --------------------------- |
| `/api/bookmarks/jobs/stats`        | GET    | Get queue statistics        |
| `/api/bookmarks/jobs/failed`       | GET    | List failed jobs            |
| `/api/bookmarks/jobs/completed`    | GET    | List completed jobs         |
| `/api/bookmarks/jobs/:jobId`       | GET    | Get specific job status     |
| `/api/bookmarks/jobs/:jobId/retry` | POST   | Manually retry a failed job |

## Tips

1. **Monitor Regularly**: Check stats endpoint periodically to catch issues early
2. **Investigate Failures**: Review failed jobs to identify patterns
3. **Track Success Rate**: Compare completed vs failed counts
4. **Use Pagination**: For large queues, use start/limit parameters
5. **Set Up Alerts**: Monitor failed count and alert if it exceeds threshold

## Example: Check Health

```bash
#!/bin/bash

TOKEN="your-token-here"
API_URL="http://localhost:3000"

# Get stats
STATS=$(curl -s "$API_URL/api/bookmarks/jobs/stats" \
  -H "Authorization: Bearer $TOKEN")

FAILED=$(echo $STATS | jq '.data.failed')
COMPLETED=$(echo $STATS | jq '.data.completed')

if [ "$FAILED" -gt 10 ]; then
  echo "⚠️  Warning: $FAILED failed jobs detected!"
fi

SUCCESS_RATE=$(echo "scale=2; $COMPLETED / ($COMPLETED + $FAILED) * 100" | bc)
echo "Success rate: ${SUCCESS_RATE}%"
```

---

**All endpoints require authentication!** Make sure to include your JWT token in the Authorization header.
