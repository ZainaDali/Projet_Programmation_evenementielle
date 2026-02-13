# HTTP Protocol Specification

This document describes the HTTP API used by the application for client-server communication. The API is RESTful and uses JSON for data exchange.

## Base URL
`http://localhost:3000`

## Headers
- `Content-Type`: `application/json` (Required for POST/PUT requests)
- `Authorization`: `Bearer <token>` (Required for protected routes)

## Authentication

### Register
Create a new user account.
- **Endpoint**: `/auth/register`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "username": "user123",
    "password": "password123"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "username": "user123", "role": "user" },
      "token": "jwt_token_here"
    }
  }
  ```

### Login
Authenticate an existing user.
- **Endpoint**: `/auth/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "username": "user123",
    "password": "password123"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "username": "user123", "role": "user" },
      "token": "jwt_token_here"
    }
  }
  ```

### Logout
Invalidate the current session token.
- **Endpoint**: `/auth/logout`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": { "message": "Logged out successfully" }
  }
  ```

### Get Current User
Retrieve details of the authenticated user.
- **Endpoint**: `/auth/me`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "username": "user123", "role": "user" }
    }
  }
  ```

### Validate Token
Check if a token is valid.
- **Endpoint**: `/auth/validate`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "valid": true,
      "user": { "id": "...", "username": "user123", "role": "user" }
    }
  }
  ```

## Health Check
Check if the API is running.
- **Endpoint**: `/health` (Assumed)
- **Method**: `GET`
- **Response**: `200 OK`
