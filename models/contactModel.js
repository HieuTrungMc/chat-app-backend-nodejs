const { pool } = require("../utils/aws-helper");

const contactModel = {
  // List all contacts for a user
  listContacts: async (userId) => {
    try {
      const query = `
        SELECT c.ContactID, c.ContactName, c.Status, 
               u.Name, u.Email, u.Phone, u.ImageUrl, u.Location
        FROM contact c
        JOIN user u ON c.ContactID = u.UserID
        WHERE c.UserID = ?
        ORDER BY c.ContactName
      `;
      
      const [contacts] = await pool.execute(query, [userId]);
      
      return contacts.map(contact => ({
        contactId: contact.ContactID.toString(),
        name: contact.ContactName || contact.Name,
        status: contact.Status,
        email: contact.Email,
        phone: contact.Phone,
        imageUrl: contact.ImageUrl,
        location: contact.Location
      }));
    } catch (error) {
      console.error("Error in listContacts:", error);
      throw error;
    }
  },
  
  // Find users by phone number (partial match) and check relationship status
  findByPhone: async (phone, userId) => {
    try {
      // Get all users matching the phone pattern with relationship information
      const query = `
        SELECT u.UserID, u.Name, u.Email, u.Phone, u.ImageUrl, u.Location,
               (SELECT COUNT(*) FROM contact c WHERE c.UserID = ? AND c.ContactID = u.UserID) > 0 AS isFriend,
               (SELECT COUNT(*) 
                FROM notification n 
                JOIN friendrequest fr ON n.NotificationID = fr.NotificationID 
                WHERE n.Sender = ? AND n.Receiver = u.UserID AND n.Type = 'friend_request' AND fr.Status = 'pending') > 0 AS friendRequestSent
        FROM user u
        WHERE u.Phone LIKE ? AND u.UserID != ?
        LIMIT 20
      `;

      const searchPattern = `%${phone}%`;
      const [users] = await pool.execute(query, [userId, userId, searchPattern, userId]);

      return users.map(user => ({
        userId: user.UserID,
        name: user.Name,
        email: user.Email,
        phone: user.Phone,
        imageUrl: user.ImageUrl,
        location: user.Location,
        friend: user.isFriend === 1,  // Convert to boolean
        friendRequestSent: user.friendRequestSent === 1  // Convert to boolean
      }));
    } catch (error) {
      console.error("Error in findByPhone:", error);
      throw error;
    }
  },
  
  // Send a friend request
  addContact: async (userId, contactId) => {
    try {
      // Check if users exist
      const userQuery = `
        SELECT UserID FROM user WHERE UserID IN (?, ?)
      `;
      const [users] = await pool.execute(userQuery, [userId, contactId]);

      if (users.length < 2) {
        return {
          success: false,
          message: "One or both users do not exist"
        };
      }
      
      // Check if they are already contacts
      const contactQuery = `
        SELECT * FROM contact 
        WHERE (UserID = ? AND ContactID = ?) OR (UserID = ? AND ContactID = ?)
      `;
      const [existingContacts] = await pool.execute(contactQuery, [userId, contactId, contactId, userId]);

      if (existingContacts.length > 0) {
      return {
          success: false,
          message: "Contact relationship already exists"
      };
    }

      // Check if there's already a pending request
      const requestQuery = `
        SELECT n.NotificationID 
        FROM notification n
        JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
        WHERE n.Sender = ? AND n.Receiver = ? AND fr.Status = 'pending'
      `;
      const [existingRequests] = await pool.execute(requestQuery, [userId, contactId]);

      if (existingRequests.length > 0) {
        return {
          success: false,
          message: "Friend request already sent"
};
      }

      // Create notification
      const notificationQuery = `
        INSERT INTO notification (Type, Sender, Receiver, CreatedAt, Details)
        VALUES ('friend_request', ?, ?, NOW(), '{}')
      `;
      const [notificationResult] = await pool.execute(notificationQuery, [userId, contactId]);

      const notificationId = notificationResult.insertId;

      // Create friend request
      const friendRequestQuery = `
        INSERT INTO friendrequest (NotificationID, Status)
        VALUES (?, 'pending')
      `;
      await pool.execute(friendRequestQuery, [notificationId]);

      return {
        success: true,
        message: "Friend request sent successfully"
      };
    } catch (error) {
      console.error("Error in addContact:", error);
      throw error;
    }
  },

  // List all friend requests for a user
  listRequests: async (userId) => {
    try {
      const query = `
        SELECT n.NotificationID, n.Sender, n.CreatedAt,
               fr.Status, u.Name, u.Email, u.Phone, u.ImageUrl
        FROM notification n
        JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
        JOIN user u ON n.Sender = u.UserID
        WHERE n.Receiver = ? AND n.Type = 'friend_request' AND fr.Status = 'pending'
        ORDER BY n.CreatedAt DESC
      `;

      const [requests] = await pool.execute(query, [userId]);

      return requests.map(request => ({
        requestId: request.NotificationID.toString(),
        senderId: request.Sender.toString(),
        senderName: request.Name,
        senderEmail: request.Email,
        senderPhone: request.Phone,
        senderImage: request.ImageUrl,
        status: request.Status,
        createdAt: request.CreatedAt
      }));
    } catch (error) {
      console.error("Error in listRequests:", error);
      throw error;
    }
  },

  // Accept a friend request
  // Accept a friend request with two-way check
  // Accept a friend request with two-way check and create a chat
  acceptRequest: async (userId, senderId) => {
    // Get a connection from the pool
    const connection = await pool.getConnection();

    try {
      // Begin transaction
      await connection.beginTransaction();

      // Find the request from sender to receiver
      const incomingRequestQuery = `
          SELECT n.NotificationID
          FROM notification n
                   JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
          WHERE n.Sender = ? AND n.Receiver = ? AND fr.Status = 'pending'
      `;
      const [incomingRequests] = await connection.execute(incomingRequestQuery, [senderId, userId]);

      // Find the request from receiver to sender (if exists)
      const outgoingRequestQuery = `
          SELECT n.NotificationID
          FROM notification n
                   JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
          WHERE n.Sender = ? AND n.Receiver = ? AND fr.Status = 'pending'
      `;
      const [outgoingRequests] = await connection.execute(outgoingRequestQuery, [userId, senderId]);

      if (incomingRequests.length === 0) {
        await connection.rollback();
        connection.release();
        return {
          success: false,
          message: "Friend request not found"
        };
      }

      const incomingNotificationId = incomingRequests[0].NotificationID;

      // Update incoming friend request status
      const updateIncomingQuery = `
          UPDATE friendrequest
          SET Status = 'accepted'
          WHERE NotificationID = ?
      `;
      await connection.execute(updateIncomingQuery, [incomingNotificationId]);

      // If there's also an outgoing request, update it too
      if (outgoingRequests.length > 0) {
        const outgoingNotificationId = outgoingRequests[0].NotificationID;

        const updateOutgoingQuery = `
            UPDATE friendrequest
            SET Status = 'accepted'
            WHERE NotificationID = ?
        `;
        await connection.execute(updateOutgoingQuery, [outgoingNotificationId]);
      }

      // Check if contact relationship already exists
      const contactCheckQuery = `
          SELECT COUNT(*) as contactExists
          FROM contact
          WHERE (UserID = ? AND ContactID = ?) OR (UserID = ? AND ContactID = ?)
      `;
      const [contactCheck] = await connection.execute(contactCheckQuery, [userId, senderId, senderId, userId]);

      // Only create contact relationship if it doesn't exist
      if (contactCheck[0].contactExists === 0) {
        // Create bidirectional contact relationship
        const contactQuery = `
        INSERT INTO contact (UserID, ContactID, ContactName, Status)
        VALUES (?, ?, (SELECT Name FROM user WHERE UserID = ?), 'active'),
               (?, ?, (SELECT Name FROM user WHERE UserID = ?), 'active')
      `;
        await connection.execute(contactQuery, [userId, senderId, senderId, senderId, userId, userId]);
      }

      // Create a chat ID by sorting the user IDs and joining with a hyphen
      const userIds = [parseInt(userId), parseInt(senderId)].sort();
      const chatId = userIds.join('-');

      // Check if chat already exists
      const chatCheckQuery = `
      SELECT COUNT(*) as chatExists
      FROM chat
      WHERE ChatID = ?
    `;
      const [chatCheck] = await connection.execute(chatCheckQuery, [chatId]);

      // Only create chat if it doesn't exist
      if (chatCheck[0].chatExists === 0) {
        // Create a new chat
        const createChatQuery = `
        INSERT INTO chat (ChatID, CreatedDate, Type, Status, Owner)
        VALUES (?, NOW(), 'private', 'active', ?)
      `;
        await connection.execute(createChatQuery, [chatId, userId]);

        // Add both users as chat members
        const addChatMembersQuery = `
        INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp)
        VALUES (?, ?, 'member', NOW()),
               (?, ?, 'member', NOW())
      `;
        await connection.execute(addChatMembersQuery, [chatId, userId, chatId, senderId]);
      }

      // Commit transaction
      await connection.commit();

      // Release connection back to pool
      connection.release();

      return {
        success: true,
        message: "Friend request accepted successfully",
        chatId: chatId
      };
    } catch (error) {
      // Rollback transaction in case of error
      await connection.rollback();

      // Release connection back to pool
      connection.release();

      console.error("Error in acceptRequest:", error);
      throw error;
    }
  },

  // List sent friend requests
  listSentRequests: async (userId) => {
    try {
      const query = `
      SELECT n.NotificationID, n.Receiver, n.CreatedAt,
             fr.Status, u.Name, u.Email, u.Phone, u.ImageUrl
      FROM notification n
      JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
      JOIN user u ON n.Receiver = u.UserID
      WHERE n.Sender = ? AND n.Type = 'friend_request' AND fr.Status = 'pending'
      ORDER BY n.CreatedAt DESC
    `;

      const [requests] = await pool.execute(query, [userId]);

      return requests.map(request => ({
        requestId: request.NotificationID,
        receiverId: request.Receiver,
        receiverName: request.Name,
        receiverEmail: request.Email,
        receiverPhone: request.Phone,
        receiverImage: request.ImageUrl,
        status: request.Status,
        createdAt: request.CreatedAt
      }));
    } catch (error) {
      console.error("Error in listSentRequests:", error);
      throw error;
    }
  }
};

module.exports = contactModel;