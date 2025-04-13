const { pool } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const chatModel = {
  getUserChats: async (userId) => {
    try {
      // SQL query to get all chats where the user is a member
      const query = `
          SELECT c.ChatID, c.CreatedDate, c.Type, c.Status, c.Owner
          FROM chat c
                   JOIN chatmember cm ON c.ChatID = cm.ChatID
          WHERE cm.UserID = ?
          ORDER BY c.CreatedDate DESC
      `;
      const [chats] = await pool.execute(query, [userId]);

      // For each chat, get the other members
      const enrichedChats = await Promise.all(chats.map(async (chat) => {
        // Query to get all members of this chat
        const membersQuery = `
            SELECT UserID
            FROM chatmember
            WHERE ChatID = ? AND UserID != ?
        `;
        const [members] = await pool.execute(membersQuery, [chat.ChatID, userId]);

        // For P2P chats, there should be one other member
        if (chat.Type === 'private' && members.length > 0) {
          const otherUserId = members[0].UserID;

          try {
            // Get user details from MySQL
            const userQuery = `
                SELECT UserID as id, Name as name, ImageUrl as image
                FROM user
                WHERE UserID = ?
            `;
            const [users] = await pool.execute(userQuery, [otherUserId]);

            if (users.length > 0) {
              const otherUser = users[0];

              return {
                ...chat,
                chatName: otherUser.name || 'Unknown User',
                imageUrl: otherUser.image || '',
                otherUserId: otherUserId
              };
            }
          } catch (error) {
            console.error(`Error fetching user ${otherUserId} details:`, error);
          }
        }

        // Default return if not a P2P chat or if user details couldn't be fetched
        return {
          ...chat,
          chatName: chat.Type === 'private' ? 'Private Chat' : 'Group Chat',
          imageUrl: '',
          otherUserId: members.length > 0 ? members[0].UserID : null
        };
      }));

      return enrichedChats;
    } catch (error) {
      console.error("Error in getUserChats:", error);
      throw error;
    }
  },

  getChatInfo: async (chatId, userId = null) => {
    try {
      // Get basic chat info
      const chatQuery = `
          SELECT c.ChatID, c.CreatedDate, c.Type, c.Status, c.Owner
          FROM chat c
          WHERE c.ChatID = ?
      `;
      const [chats] = await pool.execute(chatQuery, [chatId]);

      if (chats.length === 0) {
        return null;
      }

      const chat = chats[0];

      // If userId is provided, verify the user is a member of this chat
      if (userId) {
        const memberQuery = `
            SELECT COUNT(*) as isMember
            FROM chatmember
            WHERE ChatID = ? AND UserID = ?
        `;
        const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

        if (memberCheck[0].isMember === 0) {
          return null; // User is not a member of this chat
        }
      }

      // Get all members of the chat
      const membersQuery = `
          SELECT cm.UserID, cm.Role, u.Name, u.ImageUrl, u.Phone, u.Email, u.Location
          FROM chatmember cm
                   JOIN user u ON cm.UserID = u.UserID
          WHERE cm.ChatID = ?
      `;
      const [members] = await pool.execute(membersQuery, [chatId]);

      // Get the latest message
      const latestMessageQuery = `
          SELECT m.MessageID, m.UserID, m.Type, m.Timestamp,
                 CASE
                     WHEN m.Type = 'text' THEN tm.Content
                     WHEN m.Type = 'attachment' THEN am.Content
                     ELSE NULL
                     END as Content,
                 CASE
                     WHEN m.Type = 'attachment' THEN am.AttachmentUrl
                     ELSE NULL
                     END as AttachmentUrl,
                 u.Name as SenderName
          FROM message m
                   LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
                   LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
                   JOIN user u ON m.UserID = u.UserID
          WHERE m.ChatID = ?
          ORDER BY m.Timestamp DESC
              LIMIT 1
      `;
      const [latestMessages] = await pool.execute(latestMessageQuery, [chatId]);

      // Determine chat name and image based on type
      let chatName = '';
      let imageUrl = '';
      let otherUserId = null;

      if (chat.Type === 'private' && members.length === 2) {
        // For private chats, use the other user's name and image
        const otherMember = userId ?
            members.find(m => m.UserID !== parseInt(userId)) :
            members[0];

        if (otherMember) {
          chatName = otherMember.Name;
          imageUrl = otherMember.ImageUrl;
          otherUserId = otherMember.UserID;
        } else {
          chatName = 'Private Chat';
        }
      } else {
        // For group chats, use the chat ID as name for now
        chatName = `Group Chat ${chatId}`;
      }

      return {
        ...chat,
        chatName,
        imageUrl,
        otherUserId,
        members: members.map(m => ({
          userId: m.UserID,
          name: m.Name,
          imageUrl: m.ImageUrl,
          role: m.Role,
          phone: m.Phone,
          email: m.Email,
          location: m.Location
        })),
        latestMessage: latestMessages.length > 0 ? latestMessages[0] : null
      };
    } catch (error) {
      console.error("Error in getChatInfo:", error);
      throw error;
    }
  },

  getChatHistory: async (chatId, count = 10, userId = null, before = null) => {
    try {
      // If userId is provided, verify the user is a member of this chat
      if (userId) {
        const memberQuery = `
            SELECT COUNT(*) as isMember
            FROM chatmember
            WHERE ChatID = ? AND UserID = ?
        `;
        const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

        if (memberCheck[0].isMember === 0) {
          return []; // User is not a member of this chat
        }
      }

      // Build the query based on parameters
      let messagesQuery = `
          SELECT m.MessageID, m.UserID, m.Type, m.Timestamp, m.Reactions,
                 CASE
                     WHEN m.Type = 'text' THEN tm.Content
                     WHEN m.Type = 'attachment' THEN am.Content
                     ELSE NULL
                     END as Content,
                 CASE
                     WHEN m.Type = 'attachment' THEN am.AttachmentUrl
                     ELSE NULL
                     END as AttachmentUrl,
                 u.Name as SenderName,
                 u.ImageUrl as SenderImage
          FROM message m
                   LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
                   LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
                   JOIN user u ON m.UserID = u.UserID
          WHERE m.ChatID = ?
      `;

      const queryParams = [chatId];

      if (before) {
        messagesQuery += ' AND m.MessageID < ?';
        queryParams.push(before);
      }

      messagesQuery += ' ORDER BY m.Timestamp DESC LIMIT ?';
      queryParams.push(count);

      const [messages] = await pool.execute(messagesQuery, queryParams);

      // Format the messages
      return messages.map(msg => ({
        messageId: msg.MessageID,
        userId: msg.UserID,
        type: msg.Type,
        timestamp: msg.Timestamp,
        content: msg.Content,
        attachmentUrl: msg.AttachmentUrl,
        senderName: msg.SenderName,
        senderImage: msg.SenderImage,
        reactions: msg.Reactions ? JSON.parse(msg.Reactions) : []
      }));
    } catch (error) {
      console.error("Error in getChatHistory:", error);
      throw error;
    }
  },

  searchMessages: async (chatId, searchQuery, userId = null) => {
    try {
      // If userId is provided, verify the user is a member of this chat
      if (userId) {
        const memberQuery = `
          SELECT COUNT(*) as isMember
          FROM chatmember
          WHERE ChatID = ? AND UserID = ?
        `;
        const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

        if (memberCheck[0].isMember === 0) {
          return []; // User is not a member of this chat
        }
      }

      // Search for messages containing the search query
      const searchMessagesQuery = `
        SELECT m.MessageID, m.UserID, m.Type, m.Timestamp, m.Reactions,
               CASE 
                 WHEN m.Type = 'text' THEN tm.Content
                 WHEN m.Type = 'attachment' THEN am.Content
                 ELSE NULL
               END as Content,
               CASE
                 WHEN m.Type = 'attachment' THEN am.AttachmentUrl
                 ELSE NULL
               END as AttachmentUrl,
               u.Name as SenderName,
               u.ImageUrl as SenderImage
        FROM message m
        LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
        LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
        JOIN user u ON m.UserID = u.UserID
        WHERE m.ChatID = ? AND (
          (m.Type = 'text' AND tm.Content LIKE ?) OR
          (m.Type = 'attachment' AND am.Content LIKE ?)
        )
        ORDER BY m.Timestamp DESC
        LIMIT 50
      `;

      const searchPattern = `%${searchQuery}%`;
      const [messages] = await pool.execute(searchMessagesQuery, [chatId, searchPattern, searchPattern]);

      // Format the messages
      return messages.map(msg => ({
        messageId: msg.MessageID,
        userId: msg.UserID,
        type: msg.Type,
        timestamp: msg.Timestamp,
        content: msg.Content,
        attachmentUrl: msg.AttachmentUrl,
        senderName: msg.SenderName,
        senderImage: msg.SenderImage,
        reactions: msg.Reactions ? JSON.parse(msg.Reactions) : []
      }));
    } catch (error) {
      console.error("Error in searchMessages:", error);
      throw error;
    }
  }
};

module.exports = chatModel;