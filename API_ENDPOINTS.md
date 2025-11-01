# API Endpoints Documentation

Base URL: `http://localhost:5001/api` (Development)  
Base URL: `https://your-service-name.onrender.com/api` (Production)

---

## Authentication Endpoints

### 1. Register New User (Public)

**Endpoint:** `POST /api/auth/register`

**Authorization:** Not required (Public endpoint)

**Description:** Creates a new user. Anyone can register.

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Note:** All public registrations are created with `"user"` role. Admin role cannot be set via public registration.

**Validation Rules:**

- `username`:
  - Minimum 3 characters
  - Can only contain letters, numbers, and underscores
  - Cannot contain only numbers
- `email`: Valid email format required
- `password`:
  - Minimum 6 characters
  - Cannot contain only numbers
  - Should include at least one number or special character

**Success Response (201):**

```json
{
  "message": "User created successfully",
  "userId": 5
}
```

**Error Responses:**

- `400` - Validation errors:

```json
{
  "errors": [
    {
      "msg": "Username cannot contain only numbers",
      "param": "username",
      "location": "body"
    }
  ]
}
```

- `400` - User already exists:

```json
{
  "message": "User already exists"
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

---

### 2. Login

**Endpoint:** `POST /api/auth/login`

**Authorization:** Not required

**Request Body:**

```json
{
  "username": "admin",
  "password": "hanzlaharoon@1995"
}
```

**Success Response (200):**

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

**Error Responses:**

- `400` - Validation errors
- `401` - Invalid credentials

**cURL Example:**

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "hanzlaharoon@1995"
  }'
```

---

### 3. Get Current User Profile

**Endpoint:** `GET /api/auth/profile`

**Authorization:** Required (Bearer Token)

**Success Response (200):**

```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

---

### 4. Get All Users (Admin Only)

**Endpoint:** `GET /api/auth/users`

**Authorization:** Required (Bearer Token - Admin only)

**Success Response (200):**

```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "created_at": "2024-01-16T14:20:00.000Z"
    }
  ]
}
```

---

### 5. Delete User (Admin Only)

**Endpoint:** `DELETE /api/auth/users/:userId`

**Authorization:** Required (Bearer Token - Admin only)

**URL Parameters:**

- `userId` - ID of the user to delete

**Success Response (200):**

```json
{
  "message": "User deleted successfully",
  "deletedFiles": 5,
  "deletedFolders": 2
}
```

**Error Responses:**

- `400` - Cannot delete yourself or last admin
- `404` - User not found
- `403` - Not admin

---

## File Management Endpoints

### 6. Upload File

**Endpoint:** `POST /api/files/upload`

**Authorization:** Required (Bearer Token)

**Request:** `multipart/form-data`

**Form Data:**

- `file` (required) - The file to upload
- `folderId` (optional) - ID of folder to upload into

**Success Response (201):**

```json
{
  "message": "File uploaded successfully",
  "file": {
    "id": 10,
    "filename": "document.pdf",
    "originalName": "My Document.pdf",
    "size": 524288,
    "type": "application/pdf",
    "ftpPath": "/users/1/document.pdf"
  }
}
```

---

### 7. Get My Files

**Endpoint:** `GET /api/files/my-files?folderId=<optional>`

**Authorization:** Required (Bearer Token)

**Query Parameters:**

- `folderId` (optional) - Filter files by folder ID

**Success Response (200):**

```json
{
  "files": [
    {
      "id": 1,
      "user_id": 1,
      "folder_id": null,
      "filename": "file123.pdf",
      "original_name": "My File.pdf",
      "file_size": 1024000,
      "file_type": "application/pdf",
      "created_at": "2024-01-15T10:30:00.000Z",
      "folder": null
    }
  ]
}
```

---

### 8. Get All Files (Admin Only)

**Endpoint:** `GET /api/files/all-files?folderId=<optional>`

**Authorization:** Required (Bearer Token - Admin only)

**Query Parameters:**

- `folderId` (optional) - Filter files by folder ID

**Success Response (200):**

```json
{
  "files": [
    {
      "id": 1,
      "user_id": 1,
      "original_name": "document.pdf",
      "file_size": 1024000,
      "created_at": "2024-01-15T10:30:00.000Z",
      "user": {
        "username": "john_doe",
        "email": "john@example.com"
      },
      "folder": {
        "id": 1,
        "folder_name": "Documents"
      }
    }
  ]
}
```

---

### 9. Download File

**Endpoint:** `GET /api/files/download/:fileId`

**Authorization:** Required (Bearer Token)

**URL Parameters:**

- `fileId` - ID of the file to download

**Success Response (200):**

- Returns file as binary/stream with appropriate headers:
  - `Content-Type`: File MIME type
  - `Content-Disposition`: `attachment; filename="original_name"`
  - `Content-Length`: File size

**Error Responses:**

- `403` - No permission
- `404` - File not found
- `500` - Server error

---

### 10. Delete File (Admin Only)

**Endpoint:** `DELETE /api/files/delete/:fileId`

**Authorization:** Required (Bearer Token - Admin only)

**URL Parameters:**

- `fileId` - ID of the file to delete

**Success Response (200):**

```json
{
  "message": "File deleted successfully"
}
```

---

## Folder Management Endpoints

### 11. Create Folder

**Endpoint:** `POST /api/files/create-folder`

**Authorization:** Required (Bearer Token)

**Request Body:**

```json
{
  "folderName": "My Documents"
}
```

**Success Response (201):**

```json
{
  "message": "Folder created successfully",
  "folder": {
    "id": 5,
    "name": "My Documents",
    "ftpPath": "/users/1/My Documents"
  }
}
```

---

### 12. Get My Folders

**Endpoint:** `GET /api/files/my-folders`

**Authorization:** Required (Bearer Token)

**Success Response (200):**

```json
{
  "folders": [
    {
      "id": 1,
      "user_id": 1,
      "folder_name": "Documents",
      "ftp_path": "/users/1/Documents",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 13. Get All Folders (Admin Only)

**Endpoint:** `GET /api/files/all-folders`

**Authorization:** Required (Bearer Token - Admin only)

**Success Response (200):**

```json
{
  "folders": [
    {
      "id": 1,
      "user_id": 1,
      "folder_name": "Documents",
      "created_at": "2024-01-15T10:30:00.000Z",
      "user": {
        "username": "john_doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

---

## Health Check

### 14. Health Check

**Endpoint:** `GET /api/health`

**Authorization:** Not required

**Success Response (200):**

```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```

---

## Authentication

Most endpoints require authentication. Include the JWT token in the request header:

```
Authorization: Bearer <your_jwt_token>
```

Get a token by logging in via the `/api/auth/login` endpoint.

---

## Error Response Format

All errors follow this format:

```json
{
  "message": "Error description"
}
```

For validation errors:

```json
{
  "errors": [
    {
      "msg": "Validation error message",
      "param": "field_name",
      "location": "body"
    }
  ]
}
```

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Testing with Postman/cURL

### Get Admin Token First:

```bash
# Login to get token
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "hanzlaharoon@1995"}'
```

### Then use token for register:

```bash
# Replace YOUR_TOKEN with the token from login response
curl -X POST http://localhost:5001/api/auth/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123!",
    "role": "user"
  }'
```
