# MongoDB Aggregation Framework - Complete Guide

## Table of Contents

1. [What is Aggregation?](#what-is-aggregation)
2. [Aggregation Pipeline Concept](#aggregation-pipeline-concept)
3. [Common Stages Explained](#common-stages-explained)
4. [Practical Examples from This App](#practical-examples)
5. [Advanced Examples](#advanced-examples)
6. [Best Practices](#best-practices)

---

## What is Aggregation?

Think of MongoDB aggregation like a **data processing pipeline** - similar to how you might use `.map()`, `.filter()`, and `.reduce()` in JavaScript, but for database queries.

Instead of just finding documents, you can:

- Transform data
- Calculate statistics
- Group and summarize
- Join collections
- Filter and sort in complex ways

---

## Aggregation Pipeline Concept

An aggregation pipeline consists of **stages**. Data flows through each stage, being transformed along the way.

```javascript
db.collection.aggregate([
	{ stage1 }, // All documents enter here
	{ stage2 }, // Filtered/transformed results from stage1
	{ stage3 }, // Further processed results
])
```

Think of it like a factory assembly line - each stage does one specific job.

---

## Common Stages Explained

### 1. `$match` - Filter Documents

Like `.find()` but used in pipelines.

```javascript
{
	$match: {
		isEmailVerified: true
	}
}
// Only passes verified users to next stage
```

### 2. `$project` - Select/Transform Fields

Like selecting columns in SQL or using `.map()` in JavaScript.

```javascript
{
  $project: {
    fullName: { $concat: ["$firstName", " ", "$lastName"] },
    email: 1,
    _id: 0  // 1 = include, 0 = exclude
  }
}
```

### 3. `$group` - Aggregate Data

Like SQL's `GROUP BY` or JavaScript's `.reduce()`.

```javascript
{
  $group: {
    _id: "$isEmailVerified",  // Group by this field
    count: { $sum: 1 },       // Count documents
    emails: { $push: "$email" } // Collect all emails
  }
}
```

### 4. `$sort` - Order Results

```javascript
{
	$sort: {
		createdAt: -1
	}
} // -1 = descending, 1 = ascending
```

### 5. `$limit` - Limit Results

```javascript
{
	$limit: 10
} // Only return first 10 results
```

### 6. `$skip` - Skip Results

```javascript
{
	$skip: 20
} // Skip first 20 results (useful for pagination)
```

### 7. `$lookup` - Join Collections

Like SQL `JOIN` - combines data from multiple collections.

```javascript
{
  $lookup: {
    from: "posts",           // Other collection
    localField: "_id",       // Field in current collection
    foreignField: "userId",  // Field in other collection
    as: "userPosts"          // Name for joined data
  }
}
```

### 8. `$unwind` - Deconstruct Arrays

Converts an array field into separate documents.

```javascript
// Before: { name: "John", tags: ["a", "b"] }
{
	$unwind: "$tags"
}
// After:
//   { name: "John", tags: "a" }
//   { name: "John", tags: "b" }
```

### 9. `$addFields` - Add New Fields

```javascript
{
	$addFields: {
		fullName: {
			$concat: ["$firstName", " ", "$lastName"]
		}
	}
}
```

### 10. `$count` - Count Documents

```javascript
{
	$count: "totalUsers"
}
// Returns: { totalUsers: 42 }
```

---

## Practical Examples from This App

### Example 1: Basic User Statistics

**Goal:** Get total users, verified vs unverified count

```javascript
const stats = await User.aggregate([
	{
		$group: {
			_id: null, // Group all documents together
			totalUsers: { $sum: 1 },
			verifiedUsers: {
				$sum: { $cond: [{ $eq: ["$isEmailVerified", true] }, 1, 0] },
			},
			unverifiedUsers: {
				$sum: { $cond: [{ $eq: ["$isEmailVerified", false] }, 1, 0] },
			},
		},
	},
	{
		$project: {
			_id: 0,
			totalUsers: 1,
			verifiedUsers: 1,
			unverifiedUsers: 1,
			verificationRate: {
				$multiply: [{ $divide: ["$verifiedUsers", "$totalUsers"] }, 100],
			},
		},
	},
])

// Result:
// [{
//   totalUsers: 100,
//   verifiedUsers: 75,
//   unverifiedUsers: 25,
//   verificationRate: 75
// }]
```

**Breakdown:**

1. `$group` - Aggregates all users, counts total and verified/unverified using conditional logic
2. `$project` - Formats output and calculates verification percentage

---

### Example 2: User Registration Trends by Date

**Goal:** See how many users registered each day

```javascript
const registrationTrends = await User.aggregate([
	{
		$group: {
			_id: {
				$dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
			},
			count: { $sum: 1 },
			users: {
				$push: {
					email: "$email",
					name: { $concat: ["$firstName", " ", "$lastName"] },
				},
			},
		},
	},
	{
		$sort: { _id: -1 }, // Most recent first
	},
	{
		$limit: 30, // Last 30 days
	},
	{
		$project: {
			date: "$_id",
			count: 1,
			users: 1,
			_id: 0,
		},
	},
])

// Result:
// [
//   { date: "2026-01-07", count: 5, users: [...] },
//   { date: "2026-01-06", count: 3, users: [...] },
//   ...
// ]
```

**Breakdown:**

1. `$group` - Groups by date (formatted as YYYY-MM-DD), counts users per day
2. `$sort` - Orders by date (newest first)
3. `$limit` - Only shows last 30 days
4. `$project` - Renames `_id` to `date` for cleaner output

---

### Example 3: Active Sessions Analysis

**Goal:** Find users with multiple active sessions (many refresh tokens)

```javascript
const activeSessionsAnalysis = await User.aggregate([
	{
		$project: {
			email: 1,
			firstName: 1,
			lastName: 1,
			sessionCount: { $size: { $ifNull: ["$refreshTokens", []] } },
		},
	},
	{
		$match: {
			sessionCount: { $gt: 0 }, // Only users with active sessions
		},
	},
	{
		$sort: { sessionCount: -1 },
	},
	{
		$group: {
			_id: null,
			totalActiveSessions: { $sum: "$sessionCount" },
			averageSessionsPerUser: { $avg: "$sessionCount" },
			maxSessions: { $max: "$sessionCount" },
			usersWithMultipleSessions: {
				$sum: { $cond: [{ $gt: ["$sessionCount", 1] }, 1, 0] },
			},
			topUsers: { $push: "$$ROOT" },
		},
	},
	{
		$project: {
			_id: 0,
			totalActiveSessions: 1,
			averageSessionsPerUser: { $round: ["$averageSessionsPerUser", 2] },
			maxSessions: 1,
			usersWithMultipleSessions: 1,
			topUsers: { $slice: ["$topUsers", 10] }, // Top 10 users
		},
	},
])

// Result:
// [{
//   totalActiveSessions: 150,
//   averageSessionsPerUser: 1.5,
//   maxSessions: 5,
//   usersWithMultipleSessions: 30,
//   topUsers: [/* top 10 users by session count */]
// }]
```

**Breakdown:**

1. `$project` - Adds `sessionCount` field by getting array size
2. `$match` - Filters to only users with sessions
3. `$sort` - Orders by session count
4. `$group` - Calculates various statistics
5. `$project` - Formats output, rounds decimals, limits top users list

---

### Example 4: User Search with Full Name

**Goal:** Search users by full name (combining firstName + lastName)

```javascript
const searchUsers = async (searchTerm) => {
	return await User.aggregate([
		{
			$addFields: {
				fullName: { $concat: ["$firstName", " ", "$lastName"] },
			},
		},
		{
			$match: {
				fullName: { $regex: searchTerm, $options: "i" }, // Case-insensitive
			},
		},
		{
			$project: {
				fullName: 1,
				email: 1,
				isEmailVerified: 1,
				createdAt: 1,
			},
		},
		{
			$sort: { createdAt: -1 },
		},
		{
			$limit: 20,
		},
	])
}

// Usage: await searchUsers("John");
```

**Breakdown:**

1. `$addFields` - Creates `fullName` by combining first and last names
2. `$match` - Searches for the term in full name (case-insensitive regex)
3. `$project` - Selects only needed fields
4. `$sort` - Orders by newest first
5. `$limit` - Returns max 20 results

---

### Example 5: Pagination with Metadata

**Goal:** Paginate users with total count and page info

```javascript
const getUsersWithPagination = async (page = 1, limit = 10) => {
	const skip = (page - 1) * limit

	const result = await User.aggregate([
		{
			$facet: {
				metadata: [{ $count: "totalCount" }, { $addFields: { page, limit } }],
				users: [
					{ $skip: skip },
					{ $limit: limit },
					{
						$project: {
							fullName: { $concat: ["$firstName", " ", "$lastName"] },
							email: 1,
							isEmailVerified: 1,
							createdAt: 1,
						},
					},
				],
			},
		},
		{
			$unwind: "$metadata",
		},
		{
			$project: {
				users: 1,
				totalCount: "$metadata.totalCount",
				currentPage: "$metadata.page",
				pageSize: "$metadata.limit",
				totalPages: { $ceil: { $divide: ["$metadata.totalCount", limit] } },
			},
		},
	])

	return result[0]
}

// Result:
// {
//   users: [/* 10 user objects */],
//   totalCount: 100,
//   currentPage: 1,
//   pageSize: 10,
//   totalPages: 10
// }
```

**Breakdown:**

1. `$facet` - Runs multiple pipelines in parallel (one for count, one for data)
2. `$count` - Counts total documents
3. `$skip` & `$limit` - Implements pagination
4. `$unwind` - Flattens the metadata array
5. `$project` - Combines everything with calculated total pages

---

### Example 6: Find Inactive Users

**Goal:** Find users who haven't logged in for 30+ days (no refresh tokens)

```javascript
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const inactiveUsers = await User.aggregate([
	{
		$match: {
			createdAt: { $lt: thirtyDaysAgo }, // Account older than 30 days
			$or: [
				{ refreshTokens: { $exists: false } },
				{ refreshTokens: { $size: 0 } },
			],
		},
	},
	{
		$project: {
			fullName: { $concat: ["$firstName", " ", "$lastName"] },
			email: 1,
			createdAt: 1,
			daysSinceCreation: {
				$divide: [
					{ $subtract: [new Date(), "$createdAt"] },
					1000 * 60 * 60 * 24, // Convert ms to days
				],
			},
		},
	},
	{
		$sort: { createdAt: 1 }, // Oldest first
	},
])

// Result: List of users with no active sessions
```

**Breakdown:**

1. `$match` - Filters users created 30+ days ago with no refresh tokens
2. `$project` - Formats output and calculates days since creation
3. `$sort` - Orders by creation date (oldest first)

---

### Example 7: Email Domain Analysis

**Goal:** Group users by email domain (gmail.com, yahoo.com, etc.)

```javascript
const emailDomainStats = await User.aggregate([
	{
		$project: {
			domain: {
				$arrayElemAt: [{ $split: ["$email", "@"] }, 1],
			},
			isEmailVerified: 1,
		},
	},
	{
		$group: {
			_id: "$domain",
			totalUsers: { $sum: 1 },
			verifiedUsers: {
				$sum: { $cond: ["$isEmailVerified", 1, 0] },
			},
		},
	},
	{
		$sort: { totalUsers: -1 },
	},
	{
		$project: {
			domain: "$_id",
			totalUsers: 1,
			verifiedUsers: 1,
			unverifiedUsers: { $subtract: ["$totalUsers", "$verifiedUsers"] },
			verificationRate: {
				$round: [
					{ $multiply: [{ $divide: ["$verifiedUsers", "$totalUsers"] }, 100] },
					2,
				],
			},
			_id: 0,
		},
	},
])

// Result:
// [
//   { domain: "gmail.com", totalUsers: 50, verifiedUsers: 45, unverifiedUsers: 5, verificationRate: 90 },
//   { domain: "yahoo.com", totalUsers: 20, verifiedUsers: 15, unverifiedUsers: 5, verificationRate: 75 },
//   ...
// ]
```

**Breakdown:**

1. `$project` - Extracts domain from email using `$split` and `$arrayElemAt`
2. `$group` - Groups by domain, counts users and verified users
3. `$sort` - Orders by most popular domains
4. `$project` - Calculates additional stats and formats output

---

## Advanced Examples

### Example 8: Cohort Analysis - User Retention

**Goal:** See how many users created in each month are still active

```javascript
const cohortAnalysis = await User.aggregate([
	{
		$project: {
			cohortMonth: {
				$dateToString: { format: "%Y-%m", date: "$createdAt" },
			},
			hasActiveSessions: {
				$gt: [{ $size: { $ifNull: ["$refreshTokens", []] } }, 0],
			},
		},
	},
	{
		$group: {
			_id: "$cohortMonth",
			totalUsers: { $sum: 1 },
			activeUsers: {
				$sum: { $cond: ["$hasActiveSessions", 1, 0] },
			},
		},
	},
	{
		$project: {
			cohort: "$_id",
			totalUsers: 1,
			activeUsers: 1,
			retentionRate: {
				$round: [
					{ $multiply: [{ $divide: ["$activeUsers", "$totalUsers"] }, 100] },
					2,
				],
			},
			_id: 0,
		},
	},
	{
		$sort: { cohort: -1 },
	},
])

// Result:
// [
//   { cohort: "2026-01", totalUsers: 50, activeUsers: 45, retentionRate: 90 },
//   { cohort: "2025-12", totalUsers: 40, activeUsers: 30, retentionRate: 75 },
//   ...
// ]
```

---

### Example 9: Complex Filtering with Multiple Conditions

**Goal:** Find power users (verified, multiple sessions, created recently)

```javascript
const powerUsers = await User.aggregate([
	{
		$match: {
			isEmailVerified: true,
			createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
		},
	},
	{
		$addFields: {
			sessionCount: { $size: { $ifNull: ["$refreshTokens", []] } },
		},
	},
	{
		$match: {
			sessionCount: { $gte: 2 }, // At least 2 active sessions
		},
	},
	{
		$project: {
			fullName: { $concat: ["$firstName", " ", "$lastName"] },
			email: 1,
			sessionCount: 1,
			createdAt: 1,
			accountAge: {
				$divide: [
					{ $subtract: [new Date(), "$createdAt"] },
					1000 * 60 * 60 * 24,
				],
			},
		},
	},
	{
		$sort: { sessionCount: -1, accountAge: 1 },
	},
])
```

---

## Aggregation Operators Reference

### Arithmetic Operators

- `$add`: Add numbers → `{ $add: ["$price", "$tax"] }`
- `$subtract`: Subtract → `{ $subtract: ["$total", "$discount"] }`
- `$multiply`: Multiply → `{ $multiply: ["$price", "$quantity"] }`
- `$divide`: Divide → `{ $divide: ["$total", "$count"] }`
- `$mod`: Modulo → `{ $mod: ["$qty", 4] }`

### Comparison Operators

- `$eq`: Equal → `{ $eq: ["$status", "active"] }`
- `$ne`: Not equal → `{ $ne: ["$status", "deleted"] }`
- `$gt`: Greater than → `{ $gt: ["$age", 18] }`
- `$gte`: Greater than or equal → `{ $gte: ["$score", 100] }`
- `$lt`: Less than → `{ $lt: ["$price", 50] }`
- `$lte`: Less than or equal → `{ $lte: ["$count", 10] }`

### String Operators

- `$concat`: Join strings → `{ $concat: ["$first", " ", "$last"] }`
- `$substr`: Substring → `{ $substr: ["$email", 0, 5] }`
- `$toLower`: Lowercase → `{ $toLower: "$email" }`
- `$toUpper`: Uppercase → `{ $toUpper: "$code" }`
- `$split`: Split string → `{ $split: ["$email", "@"] }`

### Array Operators

- `$size`: Array length → `{ $size: "$items" }`
- `$push`: Add to array (in $group) → `{ $push: "$item" }`
- `$addToSet`: Add unique to array → `{ $addToSet: "$tag" }`
- `$first`: First element → `{ $first: "$items" }`
- `$last`: Last element → `{ $last: "$items" }`
- `$arrayElemAt`: Get element at index → `{ $arrayElemAt: ["$items", 0] }`

### Date Operators

- `$dateToString`: Format date → `{ $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }`
- `$year`: Extract year → `{ $year: "$date" }`
- `$month`: Extract month → `{ $month: "$date" }`
- `$dayOfMonth`: Extract day → `{ $dayOfMonth: "$date" }`

### Conditional Operators

- `$cond`: If-then-else → `{ $cond: [condition, trueVal, falseVal] }`
- `$ifNull`: Default if null → `{ $ifNull: ["$field", "default"] }`
- `$switch`: Multiple conditions (like switch/case)

### Accumulator Operators (use in $group)

- `$sum`: Sum values → `{ $sum: 1 }` or `{ $sum: "$amount" }`
- `$avg`: Average → `{ $avg: "$score" }`
- `$min`: Minimum → `{ $min: "$price" }`
- `$max`: Maximum → `{ $max: "$price" }`
- `$push`: Collect into array → `{ $push: "$item" }`
- `$addToSet`: Collect unique into array → `{ $addToSet: "$category" }`

---

## Best Practices

### 1. **Put $match Early**

Filter data as early as possible to reduce documents in the pipeline.

```javascript
// Good ✓
[
  { $match: { isEmailVerified: true } },  // Filter first
  { $project: { ... } },
  { $group: { ... } }
]

// Bad ✗
[
  { $project: { ... } },
  { $group: { ... } },
  { $match: { isEmailVerified: true } }  // Filter last (processes more data)
]
```

### 2. **Use Indexes**

Make sure your `$match` and `$sort` stages use indexed fields.

```javascript
// Create index
db.users.createIndex({ email: 1 })
db.users.createIndex({ createdAt: -1 })
```

### 3. **Limit Results Early**

Use `$limit` after sorting to avoid processing unnecessary documents.

```javascript
[
  { $match: { ... } },
  { $sort: { createdAt: -1 } },
  { $limit: 10 },  // Limit early
  { $project: { ... } }
]
```

### 4. **Use $project to Reduce Data**

Only pass forward fields you need to improve performance.

```javascript
[
  { $match: { ... } },
  { $project: { email: 1, createdAt: 1 } },  // Only 2 fields
  { $group: { ... } }
]
```

### 5. **Avoid Large Array Operations**

Be careful with `$unwind` on large arrays - it can create many documents.

### 6. **Use `allowDiskUse` for Large Datasets**

For aggregations that might exceed memory limits:

```javascript
User.aggregate([...], { allowDiskUse: true });
```

### 7. **Use `$facet` for Multiple Aggregations**

Instead of running multiple queries, use `$facet` to run them in parallel.

---

## Performance Tips

1. **Always use `$match` first** - Reduce dataset size early
2. **Create indexes** - On fields used in `$match`, `$sort`, `$group`
3. **Use `$project`** - Remove unnecessary fields early
4. **Avoid `$lookup` when possible** - Joins are expensive
5. **Use `explain()`** - See query execution plan

```javascript
User.aggregate([...]).explain("executionStats");
```

---

## Testing Your Knowledge

Try these challenges:

1. **Challenge 1**: Write an aggregation to find the 5 most recent users who haven't verified their email
2. **Challenge 2**: Calculate the average number of refresh tokens per user
3. **Challenge 3**: Find all users whose first name starts with 'A' and group them by last name
4. **Challenge 4**: Create a monthly signup report for the last 6 months

---

## Additional Resources

- [MongoDB Aggregation Docs](https://docs.mongodb.com/manual/aggregation/)
- [Aggregation Pipeline Quick Reference](https://docs.mongodb.com/manual/meta/aggregation-quick-reference/)
- [Aggregation Pipeline Optimization](https://docs.mongodb.com/manual/core/aggregation-pipeline-optimization/)

---

Happy aggregating! 🚀
