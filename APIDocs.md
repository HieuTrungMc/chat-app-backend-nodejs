# Tài liệu API Ứng dụng Trò chuyện

Tài liệu này cung cấp thông tin chi tiết về các điểm cuối REST API có sẵn trong backend của Ứng dụng Trò chuyện.

## Mục lục

- [Tổng quan](#tổng-quan)
- [API Người dùng](#api-người-dùng)
- [API Trò chuyện](#api-trò-chuyện)
- [API Danh bạ](#api-danh-bạ)
- [API Trò chuyện Nhóm](#api-trò-chuyện-nhóm)

## Tổng quan

API Ứng dụng Trò chuyện là một API RESTful cung cấp các điểm cuối cho quản lý người dùng, chức năng trò chuyện, quản lý danh bạ và chức năng trò chuyện nhóm. API được xây dựng bằng Express.js và sử dụng JSON cho các phần thân yêu cầu và phản hồi.

URL cơ sở: `http://localhost:{PORT}`

## API Người dùng

Đường dẫn cơ sở: `/user`

### Đăng ký Tài khoản

Tạo một tài khoản người dùng mới.

- **URL**: `/user/signup`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Không
- **Thân yêu cầu**:
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securepassword",
    "phone": "1234567890"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 201 CREATED
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Account created successfully",
        "userId": "123456789"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 400 BAD REQUEST
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Email already in use"
      }
      ```

### Lấy Tài khoản theo Tham số

Truy xuất thông tin tài khoản người dùng dựa trên các tham số truy vấn.

- **URL**: `/user/account`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `id=[string]` hoặc
    - `email=[string]` hoặc
    - `phone=[string]`
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "id": "123456789",
        "username": "johndoe",
        "email": "john@example.com",
        "phone": "1234567890",
        "profilePicture": "url_to_image"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "User not found"
      }
      ```

### Đăng nhập Tài khoản

Xác thực người dùng và trả về một token.

- **URL**: `/user/login`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Không
- **Thân yêu cầu**:
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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
- **Phản hồi lỗi**:
    - **Mã**: 401 UNAUTHORIZED
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Invalid credentials"
      }
      ```

### Cập nhật Tài khoản

Cập nhật thông tin tài khoản người dùng.

- **URL**: `/user/update`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "username": "newusername",
    "email": "newemail@example.com",
    "phone": "0987654321"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Account updated successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 400 BAD REQUEST
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Email already in use"
      }
      ```

### Tải lên Ảnh Hồ sơ

Tải lên ảnh hồ sơ cho người dùng.

- **URL**: `/user/upload`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Loại nội dung**: `multipart/form-data`
- **Thân yêu cầu**:
    - `image`: Tệp ảnh cần tải lên
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Image uploaded successfully",
        "imageUrl": "url_to_image"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 400 BAD REQUEST
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Invalid file type"
      }
      ```

### Đổi Mật khẩu

Thay đổi mật khẩu của người dùng.

- **URL**: `/user/changepass`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "currentPassword": "oldpassword",
    "newPassword": "newpassword"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Password changed successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 401 UNAUTHORIZED
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Current password is incorrect"
      }
      ```

### Tạo Bí mật 2FA

Tạo bí mật xác thực hai yếu tố cho người dùng.

- **URL**: `/user/2fa`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "secret": "2fa_secret_key",
        "qrCodeUrl": "url_to_qr_code"
      }
      ```

### Xác minh Mã 2FA

Xác minh mã xác thực hai yếu tố.

- **URL**: `/user/2fa/verify`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "code": "123456"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Code verified successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 401 UNAUTHORIZED
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Invalid code"
      }
      ```

## API Trò chuyện

Đường dẫn cơ sở: `/chat`

### Lấy Đường dẫn Chính

Trả về trang trò chuyện chính.

- **URL**: `/chat/`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Phản hồi thành công**:
    - **Mã**: 200 OK

### Lấy Trò chuyện của Người dùng

Truy xuất tất cả các cuộc trò chuyện cho người dùng đã xác thực.

- **URL**: `/chat/me`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Tìm kiếm Trò chuyện theo Tên

Tìm kiếm các cuộc trò chuyện theo tên.

- **URL**: `/chat/search`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `query=[string]`: Truy vấn tìm kiếm
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Lấy Thông tin Trò chuyện

Truy xuất thông tin về một cuộc trò chuyện cụ thể.

- **URL**: `/chat/:chatId/info`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `chatId=[string]`: ID của cuộc trò chuyện
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Chat not found"
      }
      ```

### Lấy Lịch sử Trò chuyện

Truy xuất lịch sử tin nhắn cho một cuộc trò chuyện cụ thể.

- **URL**: `/chat/:chatId/history/:count`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `chatId=[string]`: ID của cuộc trò chuyện
    - `count=[number]`: Số lượng tin nhắn cần truy xuất
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Tìm kiếm Tin nhắn

Tìm kiếm tin nhắn trong một cuộc trò chuyện.

- **URL**: `/chat/:chatId/search`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `chatId=[string]`: ID của cuộc trò chuyện
    - `query=[string]`: Truy vấn tìm kiếm
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Xóa Tin nhắn

Xóa một tin nhắn.

- **URL**: `/chat/deleteMsg`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "messageId": "msg123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Message deleted successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 403 FORBIDDEN
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "You don't have permission to delete this message"
      }
      ```

### Trả lời Tin nhắn

Trả lời một tin nhắn.

- **URL**: `/chat/replyToMsg`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "chatId": "chat123",
    "replyToMessageId": "msg456",
    "content": "This is a reply"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 201 CREATED
    - **Nội dung**:
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

### Chuyển tiếp Tin nhắn

Chuyển tiếp một tin nhắn đến một cuộc trò chuyện khác.

- **URL**: `/chat/forwardMsg`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "messageId": "msg123",
    "targetChatId": "chat456"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 201 CREATED
    - **Nội dung**:
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

### Lấy hoặc Tạo Trò chuyện Riêng tư

Lấy một cuộc trò chuyện riêng tư hiện có hoặc tạo một cuộc mới.

- **URL**: `/chat/private`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `userId=[string]`: ID của người dùng để trò chuyện
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "chatId": "chat123",
        "isNew": false
      }
      ```
    - Hoặc nếu một cuộc trò chuyện mới được tạo:
      ```json
      {
        "chatId": "chat456",
        "isNew": true
      }
      ```

## API Danh bạ

Đường dẫn cơ sở: `/contact`

### Liệt kê Danh bạ

Truy xuất danh sách liên hệ cho người dùng đã xác thực.

- **URL**: `/contact/list`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Tìm Liên hệ theo Số điện thoại

Tìm một liên hệ theo số điện thoại.

- **URL**: `/contact/find`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `phone=[string]`: Số điện thoại cần tìm kiếm
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "User not found"
      }
      ```

### Thêm Liên hệ

Gửi yêu cầu liên hệ đến một người dùng khác.

- **URL**: `/contact/add`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "userId": "user123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Contact request sent"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 400 BAD REQUEST
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Contact request already sent"
      }
      ```

### Liệt kê Yêu cầu Liên hệ

Truy xuất danh sách các yêu cầu liên hệ đang chờ xử lý cho người dùng đã xác thực.

- **URL**: `/contact/requests`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Chấp nhận Yêu cầu Liên hệ

Chấp nhận một yêu cầu liên hệ.

- **URL**: `/contact/accept`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "requestId": "req123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Contact request accepted"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Request not found"
      }
      ```

### Từ chối Yêu cầu Liên hệ

Từ chối một yêu cầu liên hệ.

- **URL**: `/contact/deny`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "requestId": "req123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Contact request denied"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Request not found"
      }
      ```

### Liệt kê Yêu cầu Đã gửi

Truy xuất danh sách các yêu cầu liên hệ được gửi bởi người dùng đã xác thực.

- **URL**: `/contact/sent`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Tìm Liên hệ theo Tên

Tìm một liên hệ theo tên.

- **URL**: `/contact/findByName`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `name=[string]`: Tên cần tìm kiếm
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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

### Hủy kết bạn

Xóa một liên hệ khỏi danh sách liên hệ của người dùng.

- **URL**: `/contact/unfriend`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "contactId": "user123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Contact removed successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Contact not found"
      }
      ```

### Chặn Liên hệ

Chặn một liên hệ.

- **URL**: `/contact/block`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "userId": "user123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "User blocked successfully"
      }
      ```

### Bỏ chặn Liên hệ

Bỏ chặn một liên hệ.

- **URL**: `/contact/unblock`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "userId": "user123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "User unblocked successfully"
      }
      ```

## API Trò chuyện Nhóm

Đường dẫn cơ sở: `/group`

### Tạo Nhóm

Tạo một cuộc trò chuyện nhóm mới.

- **URL**: `/group/create`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "name": "My Group Chat",
    "members": ["user123", "user456"]
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 201 CREATED
    - **Nội dung**:
      ```json
      {
        "success": true,
        "groupId": "group123",
        "name": "My Group Chat"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 400 BAD REQUEST
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Group name is required"
      }
      ```

### Thêm Thành viên vào Nhóm

Thêm một thành viên vào cuộc trò chuyện nhóm.

- **URL**: `/group/member/add`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "groupId": "group123",
    "userId": "user789"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Member added successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 403 FORBIDDEN
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "You don't have permission to add members to this group"
      }
      ```

### Xóa Thành viên khỏi Nhóm

Xóa một thành viên khỏi cuộc trò chuyện nhóm.

- **URL**: `/group/member/remove`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "groupId": "group123",
    "userId": "user789"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Member removed successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 403 FORBIDDEN
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "You don't have permission to remove members from this group"
      }
      ```

### Thay đổi Vai trò Thành viên

Thay đổi vai trò của một thành viên trong cuộc trò chuyện nhóm.

- **URL**: `/group/member/role`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "groupId": "group123",
    "userId": "user789",
    "role": "admin"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Role changed successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 403 FORBIDDEN
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "You don't have permission to change roles in this group"
      }
      ```

### Giải tán Nhóm

Giải tán một cuộc trò chuyện nhóm.

- **URL**: `/group/disband`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "groupId": "group123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Group disbanded successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 403 FORBIDDEN
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "You don't have permission to disband this group"
      }
      ```

### Lấy Thành viên Nhóm

Truy xuất danh sách thành viên trong một cuộc trò chuyện nhóm.

- **URL**: `/group/:chatId/members`
- **Phương thức**: `GET`
- **Yêu cầu xác thực**: Có
- **Tham số URL**:
    - `chatId=[string]`: ID của cuộc trò chuyện nhóm
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
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
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Group not found"
      }
      ```

### Rời Nhóm

Rời khỏi một cuộc trò chuyện nhóm.

- **URL**: `/group/leave`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "groupId": "group123"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Left group successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 404 NOT FOUND
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "Group not found"
      }
      ```

### Đổi tên Nhóm

Đổi tên một cuộc trò chuyện nhóm.

- **URL**: `/group/rename`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Thân yêu cầu**:
  ```json
  {
    "groupId": "group123",
    "name": "New Group Name"
  }
  ```
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Group renamed successfully"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 403 FORBIDDEN
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "You don't have permission to rename this group"
      }
      ```

### Cập nhật Ảnh Nhóm

Cập nhật ảnh cho một cuộc trò chuyện nhóm.

- **URL**: `/group/:chatId/updateimage`
- **Phương thức**: `POST`
- **Yêu cầu xác thực**: Có
- **Loại nội dung**: `multipart/form-data`
- **Tham số URL**:
    - `chatId=[string]`: ID của cuộc trò chuyện nhóm
- **Thân yêu cầu**:
    - `image`: Tệp ảnh cần tải lên
- **Phản hồi thành công**:
    - **Mã**: 200 OK
    - **Nội dung**:
      ```json
      {
        "success": true,
        "message": "Group image updated successfully",
        "imageUrl": "url_to_image"
      }
      ```
- **Phản hồi lỗi**:
    - **Mã**: 403 FORBIDDEN
    - **Nội dung**:
      ```json
      {
        "success": false,
        "message": "You don't have permission to update this group's image"
      }
      ```
