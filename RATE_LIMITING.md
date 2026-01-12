# Rate Limiting

This server implements comprehensive rate limiting using `express-rate-limit` with Redis as the store for distributed rate limiting support.

## Overview

Rate limiting has been implemented to protect the API from abuse, brute force attacks, and excessive requests.

## Rate Limiters

### 1. Global Rate Limiter

- **Applied to:** All requests
- **Limit:** 100 requests per 15 minutes per IP
- **Purpose:** General protection against excessive API usage
- **Headers:** Returns `RateLimit-*` headers with limit information

### 2. Authentication Rate Limiter (authLimiter)

- **Applied to:** Token refresh endpoint (`/api/auth/refresh`)
- **Limit:** 5 requests per 15 minutes per IP
- **Purpose:** Prevent abuse of token refresh mechanism
- **Special Feature:** Does not count successful requests (`skipSuccessfulRequests: true`)

### 3. Strict Rate Limiter (strictLimiter)

- **Applied to:**
  - Login endpoint (`/api/auth/login`)
  - Registration endpoint (`/api/auth/register`)
- **Limit:** 3 requests per hour per IP
- **Purpose:** Prevent brute force attacks on authentication
- **Use Case:** Critical security endpoints that need strictest protection

### 4. API Rate Limiter (apiLimiter)

- **Applied to:**
  - All analytics routes (`/api/analytics/*`)
  - All log routes (`/api/logs/*`)
- **Limit:** 50 requests per 15 minutes per IP
- **Purpose:** Protect resource-intensive API endpoints

## Redis Store

All rate limiters use Redis as the backing store, which provides:

- Distributed rate limiting across multiple server instances
- Persistent rate limit counters
- Automatic expiration of counters
- High performance

Each limiter uses a unique Redis key prefix:

- Global: `rl:global:`
- Auth: `rl:auth:`
- API: `rl:api:`
- Strict: `rl:strict:`

## Rate Limit Headers

When a rate limit is active, the following headers are returned:

```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1640000000
```

## Error Response

When rate limit is exceeded, the API returns:

```json
{
	"success": false,
	"message": "Too many requests from this IP, please try again after 15 minutes"
}
```

HTTP Status Code: `429 Too Many Requests`

## Testing Environment

Rate limiting is automatically disabled in test environments (`NODE_ENV === 'test'`).

## Customization

To modify rate limits, edit `/server/src/middleware/rateLimiter.ts`:

```typescript
export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // Time window
	max: 100, // Maximum requests
	// ... other options
})
```

## Best Practices

1. **Monitor Rate Limits:** Check Redis for rate limit keys to understand usage patterns
2. **Adjust Limits:** Based on your API usage, adjust limits accordingly
3. **Consider User Roles:** For authenticated users, you might want to implement user-based rate limiting
4. **Whitelist IPs:** For trusted IPs, add them to a whitelist by using the `skip` function

## Adding Rate Limiting to New Routes

To add rate limiting to a new route:

```typescript
import { apiLimiter } from "../middleware/rateLimiter.js"

// Apply to specific route
router.get("/endpoint", apiLimiter, controller)

// Apply to all routes in a router
router.use(apiLimiter)
```

## Troubleshooting

### Rate Limits Not Working

1. Ensure Redis is running and connected
2. Check `redisConnection` is properly configured
3. Verify middleware is applied in correct order (before routes)

### Rate Limits Too Strict

1. Adjust `max` value in the limiter configuration
2. Adjust `windowMs` to increase the time window
3. Consider using `skipSuccessfulRequests` option

### Testing Rate Limits

To test rate limits, you can temporarily lower the limits and make multiple requests:

```bash
# Make multiple requests quickly
for i in {1..10}; do curl http://localhost:5000/api/test; done
```
