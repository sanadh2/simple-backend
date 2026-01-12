# Swagger API Documentation

Your authentication API now has complete Swagger/OpenAPI documentation!

## Accessing the Documentation

Once the server is running, you can access the interactive API documentation at:

```
http://localhost:3000/api-docs
```

## Features

✅ **Interactive API Testing** - Test all endpoints directly from the browser
✅ **Authentication Support** - Built-in JWT token authorization
✅ **Complete Schema Definitions** - All request/response models documented
✅ **Try It Out** - Execute real API calls and see responses
✅ **Export Options** - Download OpenAPI spec in JSON/YAML format

## How to Use

### 1. Start the Server

```bash
npm run dev
# or
npm start
```

### 2. Open Swagger UI

Navigate to `http://localhost:3000/api-docs` in your browser.

### 3. Test Public Endpoints

You can immediately test public endpoints like:

- **POST /api/auth/register** - Create a new account
- **POST /api/auth/login** - Login with credentials

### 4. Authorize for Protected Endpoints

To test protected endpoints:

1. **Register or Login** using the register/login endpoints
2. **Copy the `accessToken`** from the response
3. **Click the "Authorize" button** (🔓) at the top of the Swagger UI
4. **Enter your token** in the format: `Bearer <your-access-token>`
   - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
5. **Click "Authorize"** and then **"Close"**

Now you can test protected endpoints like:

- **GET /api/auth/me** - Get your profile
- **POST /api/auth/logout** - Logout
- **POST /api/auth/logout-all** - Logout from all devices

### 5. Testing with Example Values

Each endpoint comes with example request bodies. Click "Try it out" and modify the examples or use the default values to test.

## Available Endpoints

### Authentication Endpoints

| Method | Endpoint               | Description           | Auth Required |
| ------ | ---------------------- | --------------------- | ------------- |
| POST   | `/api/auth/register`   | Register new user     | ❌            |
| POST   | `/api/auth/login`      | Login user            | ❌            |
| POST   | `/api/auth/logout`     | Logout current device | ✅            |
| POST   | `/api/auth/logout-all` | Logout all devices    | ✅            |
| POST   | `/api/auth/refresh`    | Refresh access token  | ❌            |
| GET    | `/api/auth/me`         | Get user profile      | ✅            |

## Example Workflow

### 1. Register a New User

```bash
POST /api/auth/register
{
  "email": "test@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### 2. Copy the Access Token

From the response, copy the `accessToken` value:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### 3. Authorize in Swagger

Click "Authorize" and enter:

```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Test Protected Endpoints

Now you can call:

```bash
GET /api/auth/me
```

This will return your user profile.

## Schema Definitions

All schemas are fully documented including:

- **User** - User profile structure
- **AuthTokens** - Access and refresh token structure
- **RegisterRequest** - Registration payload
- **LoginRequest** - Login payload
- **RefreshTokenRequest** - Token refresh payload
- **SuccessResponse** - Standard success response
- **ErrorResponse** - Standard error response

## Customization

The Swagger configuration is located at:

```
src/config/swagger.ts
```

Route documentation is in:

```
src/routes/authRoutes.ts
```

You can modify these files to:

- Add more endpoints
- Update descriptions
- Add new schemas
- Change server URLs
- Add more tags/categories

## Export OpenAPI Spec

You can export the OpenAPI specification in multiple formats:

1. **JSON Format**: Visit `http://localhost:3000/api-docs.json`
2. **YAML Format**: Available through Swagger UI download option

This spec can be used with:

- API testing tools (Postman, Insomnia)
- Code generation tools
- API gateways
- Documentation generators

## Tips

1. **Schema Validation** - Swagger validates your input against the schema
2. **Response Examples** - Check response examples to understand data structure
3. **Status Codes** - All possible response codes are documented
4. **Bearer Token** - Don't forget the "Bearer " prefix when authorizing
5. **Token Expiry** - If you get 401 errors, your token may have expired - get a new one

## Troubleshooting

### "Authorize" button not working

- Make sure you include "Bearer " before the token
- Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Getting 401 Unauthorized

- Your access token may have expired (default: 15 minutes)
- Use the `/api/auth/refresh` endpoint to get a new access token

### Can't see the documentation

- Make sure the server is running
- Check the console for any startup errors
- Visit `http://localhost:3000` first to verify the server is accessible

## Security Note

The Swagger UI is currently accessible in all environments. For production deployments, consider:

1. Disabling Swagger in production:

```typescript
if (env.NODE_ENV !== "production") {
	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))
}
```

2. Adding authentication to the documentation route
3. Using environment variables to control visibility

## Additional Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc)
