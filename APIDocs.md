# Chat Application API Documentation

This document provides detailed information about the REST API endpoints available in the Chat Application backend.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [User API](#user-api)
- [Chat API](#chat-api)
- [Contact API](#contact-api)
- [Group Chat API](#group-chat-api)

## Overview

The Chat Application API is a RESTful API that provides endpoints for user management, chat functionality, contact management, and group chat functionality. The API is built using Express.js and uses JSON for request and response bodies.

Base URL: `http://localhost:{PORT}`

## Authentication

Most endpoints require authentication. After logging in, you'll receive a token that should be included in the Authorization header of subsequent requests:

```
Authorization: Bearer {token}
```

## User API

Base path: `/user`

### Register Account

Creates a new user account.

- **URL**: `/user/signup`
- **Method**: `POST`
- **Auth required**: No
- **Request Body**:
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securepassword",
    "phone": "1234567890"
  }
  ```
- **Success Response**:
  - **Code**: 201 CREATED
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Account created successfully",
      "userId": "123456789"
    }
    ```
- **Error Response**:
  - **Code**: 400 BAD REQUEST
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Email already in use"
    }
    ```

### Get Account by Parameter

Retrieves user account information based on query parameters.

- **URL**: `/user/account`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `id=[string]` or
  - `email=[string]` or
  - `phone=[string]`
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "id": "123456789",
      "username": "johndoe",
      "email": "john@example.com",
      "phone": "1234567890",
      "profilePicture": "url_to_image"
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "User not found"
    }
    ```

### Login Account

Authenticates a user and returns a token.

- **URL**: `/user/login`
- **Method**: `POST`
- **Auth required**: No
- **Request Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "token": "jwt_token_here",
      "user": {
        "id": "123456789",
        "username": "johndoe",
        "email": "john@example.com"
      }
    }
    ```
- **Error Response**:
  - **Code**: 401 UNAUTHORIZED
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Invalid credentials"
    }
    ```

### Update Account

Updates user account information.

- **URL**: `/user/update`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "username": "newusername",
    "email": "newemail@example.com",
    "phone": "0987654321"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Account updated successfully"
    }
    ```
- **Error Response**:
  - **Code**: 400 BAD REQUEST
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Email already in use"
    }
    ```

### Upload Profile Image

Uploads a profile image for the user.

- **URL**: `/user/upload`
- **Method**: `POST`
- **Auth required**: Yes
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `image`: The image file to upload
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Image uploaded successfully",
      "imageUrl": "url_to_image"
    }
    ```
- **Error Response**:
  - **Code**: 400 BAD REQUEST
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Invalid file type"
    }
    ```

### Change Password

Changes the user's password.

- **URL**: `/user/changepass`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "currentPassword": "oldpassword",
    "newPassword": "newpassword"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Password changed successfully"
    }
    ```
- **Error Response**:
  - **Code**: 401 UNAUTHORIZED
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Current password is incorrect"
    }
    ```

### Generate 2FA Secret

Generates a two-factor authentication secret for the user.

- **URL**: `/user/2fa`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "secret": "2fa_secret_key",
      "qrCodeUrl": "url_to_qr_code"
    }
    ```

### Verify 2FA Code

Verifies a two-factor authentication code.

- **URL**: `/user/2fa/verify`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "code": "123456"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Code verified successfully"
    }
    ```
- **Error Response**:
  - **Code**: 401 UNAUTHORIZED
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Invalid code"
    }
    ```

## Chat API

Base path: `/chat`

### Get Main Path

Returns the main chat page.

- **URL**: `/chat/`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**:
  - **Code**: 200 OK

### Get User Chats

Retrieves all chats for the authenticated user.

- **URL**: `/chat/me`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "chats": [
        {
          "id": "chat123",
          "name": "Chat with Jane",
          "type": "private",
          "lastMessage": {
            "id": "msg456",
            "content": "Hello there!",
            "sender": "user789",
            "timestamp": "2023-05-20T10:30:00Z"
          }
        }
      ]
    }
    ```

### Search Chats by Name

Searches for chats by name.

- **URL**: `/chat/search`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `query=[string]`: The search query
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "chats": [
        {
          "id": "chat123",
          "name": "Chat with Jane",
          "type": "private"
        }
      ]
    }
    ```

### Get Chat Info

Retrieves information about a specific chat.

- **URL**: `/chat/:chatId/info`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `chatId=[string]`: The ID of the chat
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "id": "chat123",
      "name": "Chat with Jane",
      "type": "private",
      "participants": [
        {
          "id": "user456",
          "username": "janedoe"
        }
      ],
      "createdAt": "2023-05-01T12:00:00Z"
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Chat not found"
    }
    ```

### Get Chat History

Retrieves the message history for a specific chat.

- **URL**: `/chat/:chatId/history/:count`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `chatId=[string]`: The ID of the chat
  - `count=[number]`: The number of messages to retrieve
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "messages": [
        {
          "id": "msg123",
          "content": "Hello!",
          "sender": {
            "id": "user456",
            "username": "janedoe"
          },
          "timestamp": "2023-05-20T10:30:00Z"
        }
      ]
    }
    ```

### Search Messages

Searches for messages within a chat.

- **URL**: `/chat/:chatId/search`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `chatId=[string]`: The ID of the chat
  - `query=[string]`: The search query
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "messages": [
        {
          "id": "msg123",
          "content": "Hello!",
          "sender": {
            "id": "user456",
            "username": "janedoe"
          },
          "timestamp": "2023-05-20T10:30:00Z"
        }
      ]
    }
    ```

### Delete Message

Deletes a message.

- **URL**: `/chat/deleteMsg`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "messageId": "msg123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Message deleted successfully"
    }
    ```
- **Error Response**:
  - **Code**: 403 FORBIDDEN
  - **Content**:
    ```json
    {
      "success": false,
      "message": "You don't have permission to delete this message"
    }
    ```

### Reply to Message

Replies to a message.

- **URL**: `/chat/replyToMsg`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "chatId": "chat123",
    "replyToMessageId": "msg456",
    "content": "This is a reply"
  }
  ```
- **Success Response**:
  - **Code**: 201 CREATED
  - **Content**:
    ```json
    {
      "success": true,
      "message": {
        "id": "msg789",
        "content": "This is a reply",
        "replyTo": "msg456",
        "sender": "user123",
        "timestamp": "2023-05-20T11:30:00Z"
      }
    }
    ```

### Forward Message

Forwards a message to another chat.

- **URL**: `/chat/forwardMsg`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "messageId": "msg123",
    "targetChatId": "chat456"
  }
  ```
- **Success Response**:
  - **Code**: 201 CREATED
  - **Content**:
    ```json
    {
      "success": true,
      "message": {
        "id": "msg789",
        "content": "Forwarded message content",
        "forwardedFrom": "msg123",
        "sender": "user123",
        "timestamp": "2023-05-20T11:30:00Z"
      }
    }
    ```

### Get or Create Private Chat

Gets an existing private chat or creates a new one.

- **URL**: `/chat/private`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `userId=[string]`: The ID of the user to chat with
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "chatId": "chat123",
      "isNew": false
    }
    ```
  - Or if a new chat was created:
    ```json
    {
      "chatId": "chat456",
      "isNew": true
    }
    ```

## Contact API

Base path: `/contact`

### List Contacts

Retrieves the list of contacts for the authenticated user.

- **URL**: `/contact/list`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "contacts": [
        {
          "id": "user123",
          "username": "janedoe",
          "phone": "1234567890",
          "email": "jane@example.com",
          "profilePicture": "url_to_image"
        }
      ]
    }
    ```

### Find Contact by Phone

Finds a contact by phone number.

- **URL**: `/contact/find`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `phone=[string]`: The phone number to search for
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "user": {
        "id": "user123",
        "username": "janedoe",
        "phone": "1234567890",
        "email": "jane@example.com",
        "profilePicture": "url_to_image"
      }
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "User not found"
    }
    ```

### Add Contact

Sends a contact request to another user.

- **URL**: `/contact/add`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "userId": "user123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Contact request sent"
    }
    ```
- **Error Response**:
  - **Code**: 400 BAD REQUEST
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Contact request already sent"
    }
    ```

### List Contact Requests

Retrieves the list of pending contact requests for the authenticated user.

- **URL**: `/contact/requests`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "requests": [
        {
          "id": "req123",
          "from": {
            "id": "user456",
            "username": "johndoe"
          },
          "timestamp": "2023-05-20T10:30:00Z"
        }
      ]
    }
    ```

### Accept Contact Request

Accepts a contact request.

- **URL**: `/contact/accept`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "requestId": "req123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Contact request accepted"
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Request not found"
    }
    ```

### Deny Contact Request

Denies a contact request.

- **URL**: `/contact/deny`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "requestId": "req123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Contact request denied"
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Request not found"
    }
    ```

### List Sent Requests

Retrieves the list of contact requests sent by the authenticated user.

- **URL**: `/contact/sent`
- **Method**: `GET`
- **Auth required**: Yes
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "requests": [
        {
          "id": "req123",
          "to": {
            "id": "user456",
            "username": "janedoe"
          },
          "timestamp": "2023-05-20T10:30:00Z"
        }
      ]
    }
    ```

### Find Contact by Name

Finds a contact by name.

- **URL**: `/contact/findByName`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `name=[string]`: The name to search for
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "users": [
        {
          "id": "user123",
          "username": "janedoe",
          "phone": "1234567890",
          "email": "jane@example.com",
          "profilePicture": "url_to_image"
        }
      ]
    }
    ```

### Unfriend Contact

Removes a contact from the user's contact list.

- **URL**: `/contact/unfriend`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "contactId": "user123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Contact removed successfully"
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Contact not found"
    }
    ```

### Block Contact

Blocks a contact.

- **URL**: `/contact/block`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "userId": "user123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "User blocked successfully"
    }
    ```

### Unblock Contact

Unblocks a contact.

- **URL**: `/contact/unblock`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "userId": "user123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "User unblocked successfully"
    }
    ```

## Group Chat API

Base path: `/group`

### Create Group

Creates a new group chat.

- **URL**: `/group/create`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "name": "My Group Chat",
    "members": ["user123", "user456"]
  }
  ```
- **Success Response**:
  - **Code**: 201 CREATED
  - **Content**:
    ```json
    {
      "success": true,
      "groupId": "group123",
      "name": "My Group Chat"
    }
    ```
- **Error Response**:
  - **Code**: 400 BAD REQUEST
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Group name is required"
    }
    ```

### Add Member to Group

Adds a member to a group chat.

- **URL**: `/group/member/add`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "groupId": "group123",
    "userId": "user789"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Member added successfully"
    }
    ```
- **Error Response**:
  - **Code**: 403 FORBIDDEN
  - **Content**:
    ```json
    {
      "success": false,
      "message": "You don't have permission to add members to this group"
    }
    ```

### Remove Member from Group

Removes a member from a group chat.

- **URL**: `/group/member/remove`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "groupId": "group123",
    "userId": "user789"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Member removed successfully"
    }
    ```
- **Error Response**:
  - **Code**: 403 FORBIDDEN
  - **Content**:
    ```json
    {
      "success": false,
      "message": "You don't have permission to remove members from this group"
    }
    ```

### Change Member Role

Changes a member's role in a group chat.

- **URL**: `/group/member/role`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "groupId": "group123",
    "userId": "user789",
    "role": "admin"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Role changed successfully"
    }
    ```
- **Error Response**:
  - **Code**: 403 FORBIDDEN
  - **Content**:
    ```json
    {
      "success": false,
      "message": "You don't have permission to change roles in this group"
    }
    ```

### Disband Group

Disbands a group chat.

- **URL**: `/group/disband`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "groupId": "group123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Group disbanded successfully"
    }
    ```
- **Error Response**:
  - **Code**: 403 FORBIDDEN
  - **Content**:
    ```json
    {
      "success": false,
      "message": "You don't have permission to disband this group"
    }
    ```

### Get Group Members

Retrieves the list of members in a group chat.

- **URL**: `/group/:chatId/members`
- **Method**: `GET`
- **Auth required**: Yes
- **URL Parameters**:
  - `chatId=[string]`: The ID of the group chat
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "members": [
        {
          "id": "user123",
          "username": "johndoe",
          "role": "admin"
        },
        {
          "id": "user456",
          "username": "janedoe",
          "role": "member"
        }
      ]
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Group not found"
    }
    ```

### Leave Group

Leaves a group chat.

- **URL**: `/group/leave`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "groupId": "group123"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Left group successfully"
    }
    ```
- **Error Response**:
  - **Code**: 404 NOT FOUND
  - **Content**:
    ```json
    {
      "success": false,
      "message": "Group not found"
    }
    ```

### Rename Group

Renames a group chat.

- **URL**: `/group/rename`
- **Method**: `POST`
- **Auth required**: Yes
- **Request Body**:
  ```json
  {
    "groupId": "group123",
    "name": "New Group Name"
  }
  ```
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Group renamed successfully"
    }
    ```
- **Error Response**:
  - **Code**: 403 FORBIDDEN
  - **Content**:
    ```json
    {
      "success": false,
      "message": "You don't have permission to rename this group"
    }
    ```

### Update Group Image

Updates the image for a group chat.

- **URL**: `/group/:chatId/updateimage`
- **Method**: `POST`
- **Auth required**: Yes
- **Content-Type**: `multipart/form-data`
- **URL Parameters**:
  - `chatId=[string]`: The ID of the group chat
- **Request Body**:
  - `image`: The image file to upload
- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Group image updated successfully",
      "imageUrl": "url_to_image"
    }
    ```
- **Error Response**:
  - **Code**: 403 FORBIDDEN
  - **Content**:
    ```json
    {
      "success": false,
      "message": "You don't have permission to update this group's image"
    }
    ```