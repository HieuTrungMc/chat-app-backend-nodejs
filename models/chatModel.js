const { pool } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const chatModel = {
  getUserChats: async (userId) => {
    try {
      
      const query = `
          SELECT c.ChatID, c.CreatedDate, c.Type, c.Status, c.Owner, c.ChatImage, c.ChatName
          FROM chat c
                   JOIN chatmember cm ON c.ChatID = cm.ChatID
          WHERE cm.UserID = ?
          ORDER BY c.CreatedDate DESC
      `;
      const [chats] = await pool.execute(query, [userId]);

      const enrichedChats = await Promise.all(chats.map(async (chat) => {
        
        const membersQuery = `
            SELECT UserID
            FROM chatmember
            WHERE ChatID = ? AND UserID != ?
        `;
        const [members] = await pool.execute(membersQuery, [chat.ChatID, userId]);

        
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
                 CASE
                     WHEN m.Type = 'text' THEN tm.Type
                     WHEN m.Type = 'attachment' THEN am.Type
                     ELSE NULL
                     END as DeleteType,
                 u.Name as SenderName
          FROM message m
                   LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
                   LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
                   JOIN user u ON m.UserID = u.UserID
          WHERE m.ChatID = ?
          ORDER BY m.Timestamp DESC
              LIMIT 1
      `;
        const [latestMessages] = await pool.execute(latestMessageQuery, [chat.ChatID]);
        const lastMessage = latestMessages.length > 0 ? {
          messageId: latestMessages[0].MessageID,
          userId: latestMessages[0].UserID,
          type: latestMessages[0].Type,
          timestamp: latestMessages[0].Timestamp,
          content: latestMessages[0].Content,
          attachmentUrl: latestMessages[0].AttachmentUrl,
          deleteType: latestMessages[0].DeleteType,
          senderName: latestMessages[0].SenderName
        } : null;

        
        if (chat.Type === 'private' && members.length > 0) {
          const otherUserId = members[0].UserID;

          try {
            
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
                otherUserId: otherUserId,
                lastMessage: lastMessage
              };
            }
          } catch (error) {
            console.error(`Error fetching user ${otherUserId} details:`, error);
          }
        }

        
        return {
          ...chat,
          chatName: chat.Type === 'private' ? 'Private Chat' : chat.ChatName,
          imageUrl: chat.ChatImage,
          otherUserId: members.length > 0 ? members[0].UserID : null,
          lastMessage: lastMessage
        };
      }));

      
      enrichedChats.sort((a, b) => {
        
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;

        
        return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
      });

      return enrichedChats;
    } catch (error) {
      console.error("Error in getUserChats:", error);
      throw error;
    }
  },

  getChatInfo: async (chatId, userId = null) => {
    try {
      
      const chatQuery = `
          SELECT c.ChatID, c.CreatedDate, c.Type, c.Status, c.Owner, c.ChatImage, c.ChatName
          FROM chat c
          WHERE c.ChatID = ?
      `;
      const [chats] = await pool.execute(chatQuery, [chatId]);

      if (chats.length === 0) {
        return null;
      }

      const chat = chats[0];

      
      if (userId) {
        const memberQuery = `
            SELECT COUNT(*) as isMember
            FROM chatmember
            WHERE ChatID = ? AND UserID = ?
        `;
        const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

        if (memberCheck[0].isMember === 0) {
          return null; 
        }
      }

      
      const membersQuery = `
          SELECT cm.UserID, cm.Role, u.Name, u.ImageUrl, u.Phone, u.Email, u.Location
          FROM chatmember cm
                   JOIN user u ON cm.UserID = u.UserID
          WHERE cm.ChatID = ?
      `;
      const [members] = await pool.execute(membersQuery, [chatId]);

      
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

      
      let chatName = '';
      let imageUrl = '';
      let otherUserId = null;

      if (chat.Type === 'private' && members.length === 2) {
        
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
        
        chatName = chat.ChatName;
        imageUrl = chat.ChatImage;
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

  getChatHistory: async (chatId, count = 10, userId = null) => {
    try {
      
      if (userId) {
        const memberQuery = `
            SELECT COUNT(*) as isMember
            FROM chatmember
            WHERE ChatID = ? AND UserID = ?
        `;
        const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

        if (memberCheck[0].isMember === 0) {
          return []; 
        }
      }

      
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
                 CASE
                     WHEN m.Type = 'text' THEN tm.Type
                     WHEN m.Type = 'attachment' THEN am.Type
                     ELSE NULL
                     END as DeleteReason,
                 u.Name as SenderName,
                 u.ImageUrl as SenderImage
          FROM message m
                   LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
                   LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
                   JOIN user u ON m.UserID = u.UserID
          WHERE m.ChatID = ?
      `;

      const queryParams = [chatId];

      messagesQuery += ' ORDER BY m.Timestamp DESC LIMIT ?';
      queryParams.push(count);

      const [messages] = await pool.execute(messagesQuery, queryParams);

      
      return messages.map(msg => ({
        messageId: msg.MessageID,
        userId: msg.UserID,
        type: msg.Type,
        timestamp: msg.Timestamp,
        content: msg.Content,
        attachmentUrl: msg.AttachmentUrl,
        deleteReason: msg.DeleteReason, 
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
      
      if (userId) {
        const memberQuery = `
          SELECT COUNT(*) as isMember
          FROM chatmember
          WHERE ChatID = ? AND UserID = ?
        `;
        const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

        if (memberCheck[0].isMember === 0) {
          return []; 
        }
      }

      
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
  },

  deleteMessage: async (messageId, deleteType) => {
    try {
      
      if (deleteType !== 'remove' && deleteType !== 'unsent') {
        return {
          success: false,
          message: "Invalid delete type. Must be 'remove' or 'unsent'"
        };
      }

      const messageQuery = `
      SELECT Type
      FROM message
      WHERE MessageID = ?
    `;
      const [messages] = await pool.execute(messageQuery, [messageId]);

      if (messages.length === 0) {
        return {
          success: false,
          message: "Message not found in this chat"
        };
      }

      
      const messageType = messages[0].Type;
      let updateQuery;

      if (messageType === 'text') {
        updateQuery = `
        UPDATE textmessage
        SET Type = ?
        WHERE MessageID = ?
      `;
      } else if (messageType === 'attachment') {
        updateQuery = `
        UPDATE attachmentmessage
        SET Type = ?
        WHERE MessageID = ?
      `;
      } else {
        return {
          success: false,
          message: "Unknown message type"
        };
      }

      const [result] = await pool.execute(updateQuery, [deleteType, messageId]);

      if (result.affectedRows === 0) {
        return {
          success: false,
          message: "Failed to update message"
        };
      }

      return {
        success: true,
        message: deleteType === 'remove' ? "Message removed successfully" : "Message marked as unsent"
      };
    } catch (error) {
      console.error("Error in deleteMessage:", error);
      throw error;
    }
  },

  getOrCreatePrivateChat: async (userIdA, userIdB) => {
  try {
    // First, check if a private chat already exists between these users
    // Private chats typically have a ChatID format like "private-userA-userB" or similar
    const findChatQuery = `
      SELECT c.ChatID
      FROM chat c
      JOIN chatmember cm1 ON c.ChatID = cm1.ChatID
      JOIN chatmember cm2 ON c.ChatID = cm2.ChatID
      WHERE c.Type = 'private'
      AND cm1.UserID = ?
      AND cm2.UserID = ?
      AND c.Status = 'active'
    `;
    
    const [existingChats] = await pool.execute(findChatQuery, [userIdA, userIdB]);
    
    if (existingChats.length > 0) {
      // Chat already exists, return its ID
      return {
        success: true,
        chatId: existingChats[0].ChatID,
        isNew: false,
        message: "Existing chat found"
      };
    }
    
    // No chat exists, create a new one
    const chatId = `private-${userIdA}-${userIdB}-${Date.now()}`;
    const createdDate = new Date();
    
    // Create the chat
    const createChatQuery = `
      INSERT INTO chat (ChatID, CreatedDate, Type, Status, Owner)
      VALUES (?, ?, 'private', 'active', ?)
    `;
    await pool.execute(createChatQuery, [chatId, createdDate, userIdA]);
    
    // Add both users as members
    const addMembersQuery = `
      INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp)
      VALUES (?, ?, 'member', ?), (?, ?, 'member', ?)
    `;
    await pool.execute(addMembersQuery, [
      chatId, userIdA, createdDate,
      chatId, userIdB, createdDate
    ]);
    
    return {
      success: true,
      chatId: chatId,
      isNew: true,
      message: "New private chat created"
    };
  } catch (error) {
    console.error("Error in getOrCreatePrivateChat:", error);
    throw error;
  }
},

  searchChatsByName: async (userId, searchQuery) => {
    try {
      // Query to search for chats by name where the user is a member
      const query = `
        SELECT c.ChatID, c.CreatedDate, c.Type, c.Status, c.Owner, c.ChatImage, c.ChatName
        FROM chat c
        JOIN chatmember cm ON c.ChatID = cm.ChatID
        WHERE cm.UserID = ?
          AND (
            (c.Type = 'group' AND c.ChatName LIKE ?)
            OR c.Type = 'private'
          )
        ORDER BY c.CreatedDate DESC
      `;

      const searchPattern = `%${searchQuery}%`;
      const [chats] = await pool.execute(query, [userId, searchPattern]);

      // For private chats, we need to check the other user's name
      const enrichedChats = await Promise.all(chats.map(async (chat) => {
        // Get other members in the chat
        const membersQuery = `
          SELECT UserID
          FROM chatmember
          WHERE ChatID = ? AND UserID != ?
        `;
        const [members] = await pool.execute(membersQuery, [chat.ChatID, userId]);

        // Get latest message for each chat
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
                 CASE
                   WHEN m.Type = 'text' THEN tm.Type
                   WHEN m.Type = 'attachment' THEN am.Type
                   ELSE NULL
                 END as DeleteType,
                 u.Name as SenderName
          FROM message m
          LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
          LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
          JOIN user u ON m.UserID = u.UserID
          WHERE m.ChatID = ?
          ORDER BY m.Timestamp DESC
          LIMIT 1
        `;
        const [latestMessages] = await pool.execute(latestMessageQuery, [chat.ChatID]);
        const lastMessage = latestMessages.length > 0 ? {
          messageId: latestMessages[0].MessageID,
          userId: latestMessages[0].UserID,
          type: latestMessages[0].Type,
          timestamp: latestMessages[0].Timestamp,
          content: latestMessages[0].Content,
          attachmentUrl: latestMessages[0].AttachmentUrl,
          deleteType: latestMessages[0].DeleteType,
          senderName: latestMessages[0].SenderName
        } : null;

        // For private chats, get the other user's details
        if (chat.Type === 'private' && members.length > 0) {
          const otherUserId = members[0].UserID;

          try {
            const userQuery = `
              SELECT UserID as id, Name as name, ImageUrl as image
              FROM user
              WHERE UserID = ?
            `;
            const [users] = await pool.execute(userQuery, [otherUserId]);

            if (users.length > 0) {
              const otherUser = users[0];

              // For private chats, only include if the other user's name matches the search query
              if (searchQuery && chat.Type === 'private') {
                if (!otherUser.name || !otherUser.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                  return null; // Skip this chat if name doesn't match
}
              }

              return {
                ...chat,
                chatName: otherUser.name || 'Unknown User',
                imageUrl: otherUser.image || '',
                otherUserId: otherUserId,
                lastMessage: lastMessage
};
            }
          } catch (error) {
            console.error(`Error fetching user ${otherUserId} details:`, error);
          }
        }

        return {
          ...chat,
          chatName: chat.Type === 'private' ? 'Private Chat' : chat.ChatName,
          imageUrl: chat.ChatImage,
          otherUserId: members.length > 0 ? members[0].UserID : null,
          lastMessage: lastMessage
        };
      }));

      // Filter out null values (private chats that didn't match the search)
      const filteredChats = enrichedChats.filter(chat => chat !== null);

      // Sort by latest message
      filteredChats.sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
      });

      return filteredChats;
    } catch (error) {
      console.error("Error in searchChatsByName:", error);
      throw error;
    }
  }
};

module.exports = chatModel;