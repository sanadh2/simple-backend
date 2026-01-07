# MongoDB Aggregation API - Testing Guide

This guide shows you how to test all the aggregation endpoints we've created.

## Prerequisites

1. Start the server: `npm run dev`
2. Register/Login to get an access token
3. Use the token in the `Authorization` header for all analytics requests

---

## API Endpoints

### 1. Get User Statistics

**Endpoint:** `GET /api/analytics/statistics`

**What it does:** Returns overall user statistics including total users, verified/unverified counts, and verification rate.

**Aggregation Concepts Used:**
- `$group` - Groups all users together
- `$sum` with `$cond` - Conditional counting
- `$project` - Calculates verification percentage

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/analytics/statistics \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "User statistics retrieved successfully",
  "data": {
    "totalUsers": 100,
    "verifiedUsers": 75,
    "unverifiedUsers": 25,
    "verificationRate": 75
  }
}
```

---

### 2. Get Registration Trends

**Endpoint:** `GET /api/analytics/registration-trends?days=30`

**What it does:** Shows how many users registered each day for the last N days.

**Aggregation Concepts Used:**
- `$match` - Filters by date range
- `$group` - Groups by date
- `$dateToString` - Formats dates
- `$push` - Collects user details into array
- `$sort` - Orders by date

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/analytics/registration-trends?days=7" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Registration trends retrieved successfully",
  "data": [
    {
      "date": "2026-01-07",
      "count": 5,
      "users": [
        {
          "email": "user1@example.com",
          "name": "John Doe",
          "isVerified": true
        }
      ]
    }
  ]
}
```

---

### 3. Get Active Sessions Analysis

**Endpoint:** `GET /api/analytics/active-sessions`

**What it does:** Analyzes active user sessions (refresh tokens) and shows statistics.

**Aggregation Concepts Used:**
- `$project` with `$size` - Counts array elements
- `$match` - Filters users with sessions
- `$facet` - Runs multiple pipelines in parallel
- `$group` with accumulators - Calculates statistics
- `$avg`, `$max`, `$sum` - Aggregation operators

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/analytics/active-sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Active sessions analysis retrieved successfully",
  "data": {
    "statistics": {
      "totalActiveSessions": 150,
      "averageSessionsPerUser": 1.5,
      "maxSessions": 5,
      "usersWithSessions": 100,
      "usersWithMultipleSessions": 30
    },
    "topUsers": [
      {
        "fullName": "John Doe",
        "email": "john@example.com",
        "sessionCount": 5
      }
    ]
  }
}
```

---

### 4. Search Users by Name

**Endpoint:** `GET /api/analytics/search?q=john&limit=20`

**What it does:** Searches users by full name (combines firstName + lastName).

**Aggregation Concepts Used:**
- `$addFields` - Creates computed fields
- `$concat` - Combines strings
- `$match` with `$regex` - Pattern matching
- `$limit` - Limits results

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/analytics/search?q=john&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Users found successfully",
  "data": [
    {
      "fullName": "John Doe",
      "email": "john@example.com",
      "isEmailVerified": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 5. Get Paginated Users

**Endpoint:** `GET /api/analytics/users?page=1&limit=10`

**What it does:** Returns paginated list of users with metadata (total count, pages, etc.).

**Aggregation Concepts Used:**
- `$facet` - Runs count and data pipelines in parallel
- `$skip` and `$limit` - Implements pagination
- `$count` - Counts total documents
- `$ceil` and `$divide` - Calculates total pages

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/analytics/users?page=2&limit=5" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "fullName": "John Doe",
        "email": "john@example.com",
        "isEmailVerified": true,
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "totalCount": 100,
    "currentPage": 2,
    "pageSize": 5,
    "totalPages": 20
  }
}
```

---

### 6. Get Inactive Users

**Endpoint:** `GET /api/analytics/inactive-users?days=30`

**What it does:** Finds users who haven't logged in for N days (no active sessions).

**Aggregation Concepts Used:**
- `$match` with date comparison - Filters by date
- `$or` - Multiple conditions
- `$size` - Checks array length
- `$subtract` - Date arithmetic
- `$divide` - Converts milliseconds to days

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/analytics/inactive-users?days=60" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Inactive users retrieved successfully",
  "data": [
    {
      "fullName": "Jane Smith",
      "email": "jane@example.com",
      "isEmailVerified": false,
      "createdAt": "2025-10-01T00:00:00.000Z",
      "daysSinceCreation": 98
    }
  ]
}
```

---

### 7. Get Email Domain Statistics

**Endpoint:** `GET /api/analytics/email-domains`

**What it does:** Groups users by email domain and shows statistics per domain.

**Aggregation Concepts Used:**
- `$split` - Splits string by delimiter
- `$arrayElemAt` - Gets element from array
- `$group` - Groups by domain
- `$subtract` - Calculates unverified count
- `$multiply` and `$divide` - Calculates percentages

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/analytics/email-domains \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Email domain statistics retrieved successfully",
  "data": [
    {
      "domain": "gmail.com",
      "totalUsers": 50,
      "verifiedUsers": 45,
      "unverifiedUsers": 5,
      "verificationRate": 90
    },
    {
      "domain": "yahoo.com",
      "totalUsers": 20,
      "verifiedUsers": 15,
      "unverifiedUsers": 5,
      "verificationRate": 75
    }
  ]
}
```

---

### 8. Get Cohort Analysis

**Endpoint:** `GET /api/analytics/cohort-analysis`

**What it does:** Shows user retention by signup month (cohort analysis).

**Aggregation Concepts Used:**
- `$dateToString` with format - Groups by month
- `$gt` with `$size` - Checks if array has elements
- `$cond` - Conditional logic
- `$subtract` - Calculates inactive users

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/analytics/cohort-analysis \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Cohort analysis retrieved successfully",
  "data": [
    {
      "cohort": "2026-01",
      "totalUsers": 50,
      "activeUsers": 45,
      "inactiveUsers": 5,
      "retentionRate": 90
    },
    {
      "cohort": "2025-12",
      "totalUsers": 40,
      "activeUsers": 30,
      "inactiveUsers": 10,
      "retentionRate": 75
    }
  ]
}
```

---

### 9. Get Power Users

**Endpoint:** `GET /api/analytics/power-users`

**What it does:** Finds "power users" - verified users with multiple active sessions created in last 90 days.

**Aggregation Concepts Used:**
- Multiple `$match` stages - Filters at different points
- `$addFields` - Adds computed fields
- `$gte` - Date comparison
- `$round` - Rounds numbers
- Multiple sort fields - Complex sorting

**Example Request:**
```bash
curl -X GET http://localhost:3000/api/analytics/power-users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Power users retrieved successfully",
  "data": [
    {
      "fullName": "John Doe",
      "email": "john@example.com",
      "sessionCount": 5,
      "createdAt": "2025-12-01T00:00:00.000Z",
      "accountAgeDays": 37
    }
  ]
}
```

---

## Testing with Postman

1. **Import Collection:**
   - Create a new collection called "Analytics API"
   - Add a variable `{{baseUrl}}` = `http://localhost:3000`
   - Add a variable `{{accessToken}}` = your access token

2. **Set Authorization:**
   - In collection settings, add Authorization header:
   - Type: Bearer Token
   - Token: `{{accessToken}}`

3. **Create Requests:**
   - Add each endpoint above as a separate request
   - Test with different query parameters

---

## Testing with JavaScript/Fetch

```javascript
const accessToken = 'YOUR_ACCESS_TOKEN';

async function testAnalytics() {
  // 1. Get Statistics
  const stats = await fetch('http://localhost:3000/api/analytics/statistics', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }).then(r => r.json());
  console.log('Statistics:', stats);

  // 2. Get Registration Trends (last 7 days)
  const trends = await fetch('http://localhost:3000/api/analytics/registration-trends?days=7', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }).then(r => r.json());
  console.log('Trends:', trends);

  // 3. Search Users
  const search = await fetch('http://localhost:3000/api/analytics/search?q=john', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }).then(r => r.json());
  console.log('Search Results:', search);

  // 4. Get Paginated Users
  const users = await fetch('http://localhost:3000/api/analytics/users?page=1&limit=10', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }).then(r => r.json());
  console.log('Paginated Users:', users);

  // 5. Get Email Domain Stats
  const domains = await fetch('http://localhost:3000/api/analytics/email-domains', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  }).then(r => r.json());
  console.log('Domain Stats:', domains);
}

testAnalytics();
```

---

## Learning Path

To understand aggregations better, try testing the endpoints in this order:

1. **Start Simple:** `GET /api/analytics/statistics`
   - Learn: `$group`, `$sum`, `$cond`

2. **Add Filtering:** `GET /api/analytics/registration-trends?days=7`
   - Learn: `$match`, `$dateToString`, `$push`

3. **Computed Fields:** `GET /api/analytics/search?q=john`
   - Learn: `$addFields`, `$concat`, `$regex`

4. **Parallel Pipelines:** `GET /api/analytics/users?page=1&limit=10`
   - Learn: `$facet`, `$skip`, `$limit`, `$count`

5. **Complex Analysis:** `GET /api/analytics/active-sessions`
   - Learn: `$size`, `$avg`, `$max`, multiple accumulators

6. **Advanced:** `GET /api/analytics/cohort-analysis`
   - Learn: Date grouping, retention calculations

---

## Pro Tips

1. **Check Logs:** The server logs each request with correlation ID - useful for debugging
2. **Use Query Parameters:** Most endpoints accept parameters to customize results
3. **Compare Results:** Run the same aggregation with different parameters to see how stages work
4. **Read the Code:** Check `server/src/services/analyticsService.ts` to see the actual aggregation pipelines
5. **Experiment:** Modify the aggregations to add new fields or change calculations

---

## Next Steps

1. Try all the endpoints with real data
2. Read the comprehensive guide: `MONGODB_AGGREGATION_GUIDE.md`
3. Modify existing aggregations to add new features
4. Create your own custom aggregations

Happy learning! 🚀

