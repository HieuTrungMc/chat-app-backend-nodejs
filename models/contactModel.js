const { pool } = require("../utils/aws-helper");

const contactModel = {

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


  findByPhone: async (phone, userId) => {
    try {

      const query = `
          SELECT u.UserID, u.Name, u.Email, u.Phone, u.ImageUrl, u.Location,
                 (SELECT COUNT(*) FROM contact c WHERE c.UserID = ? AND c.ContactID = u.UserID) > 0 AS isFriend,
                 (SELECT Status FROM contact c WHERE c.UserID = ? AND c.ContactID = u.UserID) AS contactStatus,
                 (SELECT COUNT(*)
                  FROM notification n
                           JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
                  WHERE n.Sender = ? AND n.Receiver = u.UserID AND n.Type = 'friend_request' AND fr.Status = 'pending') > 0 AS friendRequestSent
          FROM user u
          WHERE u.Phone LIKE ? AND u.UserID != ?
          LIMIT 20
      `;

      const searchPattern = `%${phone}%`;
      const [users] = await pool.execute(query, [userId, userId, userId, searchPattern, userId]);

      return users.map(user => ({
        userId: user.UserID,
        name: user.Name,
        email: user.Email,
        phone: user.Phone,
        imageUrl: user.ImageUrl,
        location: user.Location,
        friend: user.isFriend === 1,
        friendRequestSent: user.friendRequestSent === 1,
        contactStatus: user.contactStatus
      }));
    } catch (error) {
      console.error("Error in findByPhone:", error);
      throw error;
    }
  },

  findByName: async (name, userId) => {
    try {
      const query = `
          SELECT u.UserID, u.Name, u.Email, u.Phone, u.ImageUrl, u.Location,
                 (SELECT COUNT(*) FROM contact c WHERE c.UserID = ? AND c.ContactID = u.UserID) > 0 AS isFriend,
                 (SELECT Status FROM contact c WHERE c.UserID = ? AND c.ContactID = u.UserID) AS contactStatus,
                 (SELECT COUNT(*)
                  FROM notification n
                           JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
                  WHERE n.Sender = ? AND n.Receiver = u.UserID AND n.Type = 'friend_request' AND fr.Status = 'pending') > 0 AS friendRequestSent
          FROM user u
          WHERE u.Name LIKE ? AND u.UserID != ?
          LIMIT 20
      `;

      const searchPattern = `%${name}%`;
      const [users] = await pool.execute(query, [userId, userId, userId, searchPattern, userId]);

      return users.map(user => ({
        userId: user.UserID,
        name: user.Name,
        email: user.Email,
        phone: user.Phone,
        imageUrl: user.ImageUrl,
        location: user.Location,
        friend: user.isFriend === 1,
        friendRequestSent: user.friendRequestSent === 1,
        contactStatus: user.contactStatus
      }));
    } catch (error) {
      console.error("Error in findByName:", error);
      throw error;
    }
  },


  addContact: async (userId, contactId) => {
    try {

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


      const notificationQuery = `
        INSERT INTO notification (Type, Sender, Receiver, CreatedAt, Details)
        VALUES ('friend_request', ?, ?, NOW(), '{}')
      `;
      const [notificationResult] = await pool.execute(notificationQuery, [userId, contactId]);

      const notificationId = notificationResult.insertId;


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

  acceptRequest: async (userId, senderId) => {

    const connection = await pool.getConnection();

    try {

      await connection.beginTransaction();


      const incomingRequestQuery = `
          SELECT n.NotificationID
          FROM notification n
                   JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
          WHERE n.Sender = ? AND n.Receiver = ? AND fr.Status = 'pending'
      `;
      const [incomingRequests] = await connection.execute(incomingRequestQuery, [senderId, userId]);


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


      const updateIncomingQuery = `
          UPDATE friendrequest
          SET Status = 'accepted'
          WHERE NotificationID = ?
      `;
      await connection.execute(updateIncomingQuery, [incomingNotificationId]);


      if (outgoingRequests.length > 0) {
        const outgoingNotificationId = outgoingRequests[0].NotificationID;

        const updateOutgoingQuery = `
            UPDATE friendrequest
            SET Status = 'accepted'
            WHERE NotificationID = ?
        `;
        await connection.execute(updateOutgoingQuery, [outgoingNotificationId]);
      }


      const contactCheckQuery = `
          SELECT COUNT(*) as contactExists
          FROM contact
          WHERE (UserID = ? AND ContactID = ?) OR (UserID = ? AND ContactID = ?)
      `;
      const [contactCheck] = await connection.execute(contactCheckQuery, [userId, senderId, senderId, userId]);


      if (contactCheck[0].contactExists === 0) {

        const contactQuery = `
        INSERT INTO contact (UserID, ContactID, ContactName, Status)
        VALUES (?, ?, (SELECT Name FROM user WHERE UserID = ?), 'active'),
               (?, ?, (SELECT Name FROM user WHERE UserID = ?), 'active')
      `;
        await connection.execute(contactQuery, [userId, senderId, senderId, senderId, userId, userId]);
      }


      const userIds = [parseInt(userId), parseInt(senderId)].sort();
      const chatId = userIds.join('-');


      const chatCheckQuery = `
      SELECT COUNT(*) as chatExists
      FROM chat
      WHERE ChatID = ?
    `;
      const [chatCheck] = await connection.execute(chatCheckQuery, [chatId]);


      if (chatCheck[0].chatExists === 0) {

        const createChatQuery = `
        INSERT INTO chat (ChatID, CreatedDate, Type, Status, Owner)
        VALUES (?, NOW(), 'private', 'active', ?)
      `;
        await connection.execute(createChatQuery, [chatId, userId]);


        const addChatMembersQuery = `
        INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp)
        VALUES (?, ?, 'member', NOW()),
               (?, ?, 'member', NOW())
      `;
        await connection.execute(addChatMembersQuery, [chatId, userId, chatId, senderId]);
      }


      await connection.commit();


      connection.release();

      return {
        success: true,
        message: "Friend request accepted successfully",
        chatId: chatId
      };
    } catch (error) {

      await connection.rollback();


      connection.release();

      console.error("Error in acceptRequest:", error);
      throw error;
    }
  },

  denyRequest: async (userId, senderId) => {
    try {

      const connection = await pool.getConnection();

      try {

        await connection.beginTransaction();


        const incomingRequestQuery = `
        SELECT n.NotificationID
        FROM notification n
        JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
        WHERE n.Sender = ? AND n.Receiver = ? AND fr.Status = 'pending'
      `;
        const [incomingRequests] = await connection.execute(incomingRequestQuery, [senderId, userId]);


        const outgoingRequestQuery = `
        SELECT n.NotificationID
        FROM notification n
        JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
        WHERE n.Sender = ? AND n.Receiver = ? AND fr.Status = 'pending'
      `;
        const [outgoingRequests] = await connection.execute(outgoingRequestQuery, [userId, senderId]);

        if (incomingRequests.length === 0 && outgoingRequests.length === 0) {
          await connection.rollback();
          connection.release();
          return {
            success: false,
            message: "No friend requests found between these users"
          };
        }


        if (incomingRequests.length > 0) {
          const incomingNotificationId = incomingRequests[0].NotificationID;


          const deleteIncomingRequestQuery = `
          DELETE FROM friendrequest
          WHERE NotificationID = ?
        `;
          await connection.execute(deleteIncomingRequestQuery, [incomingNotificationId]);


          const deleteIncomingNotificationQuery = `
          DELETE FROM notification
          WHERE NotificationID = ?
        `;
          await connection.execute(deleteIncomingNotificationQuery, [incomingNotificationId]);
        }


        if (outgoingRequests.length > 0) {
          const outgoingNotificationId = outgoingRequests[0].NotificationID;


          const deleteOutgoingRequestQuery = `
          DELETE FROM friendrequest
          WHERE NotificationID = ?
        `;
          await connection.execute(deleteOutgoingRequestQuery, [outgoingNotificationId]);


          const deleteOutgoingNotificationQuery = `
          DELETE FROM notification
          WHERE NotificationID = ?
        `;
          await connection.execute(deleteOutgoingNotificationQuery, [outgoingNotificationId]);
        }


        await connection.commit();
        connection.release();

        return {
          success: true,
          message: "Friend request(s) removed successfully"
        };
      } catch (error) {

        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error("Error in denyRequest:", error);
      throw error;
    }
  },

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
  },

  unfriendContact: async (userId, contactId) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if the contact relationship exists
      const contactQuery = `
        SELECT * FROM contact 
        WHERE (UserID = ? AND ContactID = ?) OR (UserID = ? AND ContactID = ?)
      `;
      const [existingContacts] = await connection.execute(contactQuery, [userId, contactId, contactId, userId]);

      if (existingContacts.length === 0) {
        await connection.rollback();
        connection.release();
        return {
          success: false,
          message: "Contact relationship does not exist"
        };
      }

      // Delete the contact relationship in both directions
      const deleteContactQuery = `
        DELETE FROM contact 
        WHERE (UserID = ? AND ContactID = ?) OR (UserID = ? AND ContactID = ?)
      `;
      await connection.execute(deleteContactQuery, [userId, contactId, contactId, userId]);

      // Also delete any pending friend requests between these users
      const requestIdsQuery = `
        SELECT n.NotificationID 
        FROM notification n
        JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
        WHERE ((n.Sender = ? AND n.Receiver = ?) OR (n.Sender = ? AND n.Receiver = ?))
          AND n.Type = 'friend_request'
      `;
      const [requestIds] = await connection.execute(requestIdsQuery, [userId, contactId, contactId, userId]);

      if (requestIds.length > 0) {
        const notificationIds = requestIds.map(r => r.NotificationID);

        // Delete the friend requests
        const deleteFriendRequestsQuery = `
          DELETE FROM friendrequest
          WHERE NotificationID IN (?)
        `;
        await connection.execute(deleteFriendRequestsQuery, [notificationIds]);

        // Delete the notifications
        const deleteNotificationsQuery = `
          DELETE FROM notification
          WHERE NotificationID IN (?)
        `;
        await connection.execute(deleteNotificationsQuery, [notificationIds]);
      }

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: "Contact unfriended successfully"
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error("Error in unfriendContact:", error);
      throw error;
    }
  },

  blockContact: async (userId, contactId) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if users exist
      const userQuery = `
        SELECT UserID FROM user WHERE UserID IN (?, ?)
      `;
      const [users] = await connection.execute(userQuery, [userId, contactId]);

      if (users.length < 2) {
        await connection.rollback();
        connection.release();
        return {
          success: false,
          message: "One or both users do not exist"
        };
      }

      // Check if the contact is already blocked
      const blockCheckQuery = `
        SELECT * FROM contact 
        WHERE UserID = ? AND ContactID = ? AND Status = 'blocked'
      `;
      const [blockedContacts] = await connection.execute(blockCheckQuery, [userId, contactId]);

      if (blockedContacts.length > 0) {
        await connection.rollback();
        connection.release();
        return {
          success: false,
          message: "Contact is already blocked"
        };
      }

      // Check if contact relationship exists
      const contactQuery = `
        SELECT * FROM contact 
        WHERE UserID = ? AND ContactID = ?
      `;
      const [existingContacts] = await connection.execute(contactQuery, [userId, contactId]);

      if (existingContacts.length > 0) {
        // Update existing contact to blocked status
        const updateContactQuery = `
          UPDATE contact 
          SET Status = 'blocked' 
          WHERE UserID = ? AND ContactID = ?
        `;
        await connection.execute(updateContactQuery, [userId, contactId]);
      } else {
        // Create new blocked contact
        const insertContactQuery = `
          INSERT INTO contact (UserID, ContactID, ContactName, Status)
          VALUES (?, ?, (SELECT Name FROM user WHERE UserID = ?), 'blocked')
        `;
        await connection.execute(insertContactQuery, [userId, contactId, contactId]);
      }

      // Delete any pending friend requests between these users
      const requestIdsQuery = `
        SELECT n.NotificationID 
        FROM notification n
        JOIN friendrequest fr ON n.NotificationID = fr.NotificationID
        WHERE ((n.Sender = ? AND n.Receiver = ?) OR (n.Sender = ? AND n.Receiver = ?))
          AND n.Type = 'friend_request'
      `;
      const [requestIds] = await connection.execute(requestIdsQuery, [userId, contactId, contactId, userId]);

      if (requestIds.length > 0) {
        const notificationIds = requestIds.map(r => r.NotificationID);

        // Delete the friend requests
        const deleteFriendRequestsQuery = `
          DELETE FROM friendrequest
          WHERE NotificationID IN (?)
        `;
        await connection.execute(deleteFriendRequestsQuery, [notificationIds]);

        // Delete the notifications
        const deleteNotificationsQuery = `
          DELETE FROM notification
          WHERE NotificationID IN (?)
        `;
        await connection.execute(deleteNotificationsQuery, [notificationIds]);
      }

      await connection.commit();
      connection.release();

      return {
        success: true,
        message: "Contact blocked successfully"
      };
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error("Error in blockContact:", error);
      throw error;
    }
  },

  unblockContact: async (userId, contactId) => {
    try {
      // Check if the contact is blocked
      const blockCheckQuery = `
        SELECT * FROM contact 
        WHERE UserID = ? AND ContactID = ? AND Status = 'blocked'
      `;
      const [blockedContacts] = await pool.execute(blockCheckQuery, [userId, contactId]);

      if (blockedContacts.length === 0) {
        return {
          success: false,
          message: "Contact is not blocked"
        };
      }

      // Update contact status to active
      const updateContactQuery = `
        UPDATE contact 
        SET Status = 'active' 
        WHERE UserID = ? AND ContactID = ?
      `;
      await pool.execute(updateContactQuery, [userId, contactId]);

      return {
        success: true,
        message: "Contact unblocked successfully"
      };
    } catch (error) {
      console.error("Error in unblockContact:", error);
      throw error;
    }
  }
};

module.exports = contactModel;