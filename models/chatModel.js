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

  deleteMessage: async (messageId, deleteType, userId = null) => {
    try {
      if (!['remove', 'unsent', 'delete_for_me'].includes(deleteType)) {
        return {
          success: false,
          message: "Invalid delete type. Must be 'remove', 'unsent', or 'delete_for_me'"
        };
      }

      const messageQuery = `
        SELECT m.Type, m.UserID, m.ChatID
        FROM message m
        WHERE m.MessageID = ?
    `;
      const [messages] = await pool.execute(messageQuery, [messageId]);

      if (messages.length === 0) {
        return {
          success: false,
          message: "Message not found"
        };
      }

      const message = messages[0];

      // For 'unsent', verify the user is the sender
      if (deleteType === 'unsent' && userId && message.UserID !== userId) {
        return {
          success: false,
          message: "You can only unsend your own messages"
        };
      }

      // For personal deletion, create a record in message_deletions table
      if (deleteType === 'delete_for_me') {
        if (!userId) {
        return {
          success: false,
            message: "User ID is required for personal deletion"
        };
      }

        // Check if user is a member of the chat
        const memberQuery = `
          SELECT COUNT(*) as isMember
            FROM chatmember
          WHERE ChatID = ? AND UserID = ?
        `;
        const [memberCheck] = await pool.execute(memberQuery, [message.ChatID, userId]);

        if (memberCheck[0].isMember === 0) {
              return {
            success: false,
            message: "You are not a member of this chat"
              };
            }

        // Insert into message_deletions table
        const insertDeletionQuery = `
          INSERT INTO message_deletions (MessageID, UserID, DeletedTimestamp)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE DeletedTimestamp = ?
        `;
        const now = new Date();
        await pool.execute(insertDeletionQuery, [messageId, userId, now, now]);
        return {
          success: true,
          message: "Message deleted from your view"
        };
      } else {
        // For 'remove' or 'unsent', update the message type
        let updateQuery;

        if (message.Type === 'text') {
          updateQuery = `
            UPDATE textmessage
            SET Type = ?
            WHERE MessageID = ?
          `;
        } else if (message.Type === 'attachment') {
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
      }
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
      const query = `
          SELECT c.ChatID, c.CreatedDate, c.Type, c.Status, c.Owner, c.ChatImage, c.ChatName
          FROM chat c
                   JOIN chatmember cm ON c.ChatID = cm.ChatID
          WHERE cm.UserID = ?
            AND c.Status != 'disbanded'
            AND (
              (c.Type = 'group' AND c.ChatName LIKE ?)
                  OR c.Type = 'private'
              )
          ORDER BY c.CreatedDate DESC
      `;

      const searchPattern = `%${searchQuery}%`;
      const [chats] = await pool.execute(query, [userId, searchPattern]);

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

              if (searchQuery && chat.Type === 'private') {
                if (!otherUser.name || !otherUser.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                  return null;
                }
              }

              return {
                ...chat,
                id: userId,
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
  },

  replyToMessage: async (chatId, userId, originalMessageId, replyContent, replyType = 'text', attachmentUrl = null) => {
    try {
      // Verify user is a member of the chat
      const memberQuery = `
        SELECT COUNT(*) as isMember
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

      if (memberCheck[0].isMember === 0) {
        return {
          success: false,
          message: "You are not a member of this chat"
        };
      }

      // Verify original message exists
      const originalMessageQuery = `
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
        WHERE m.MessageID = ? AND m.ChatID = ?
      `;
      const [originalMessages] = await pool.execute(originalMessageQuery, [originalMessageId, chatId]);

      if (originalMessages.length === 0) {
        return {
          success: false,
          message: "Original message not found"
        };
      }

      const originalMessage = originalMessages[0];
      const timestamp = new Date();

      // Create the new message
      const insertMessageQuery = `
        INSERT INTO message (ChatID, UserID, Type, Timestamp, replyTo)
        VALUES (?, ?, ?, ?, ?)
      `;
      const [messageResult] = await pool.execute(insertMessageQuery, [
        chatId,
        userId,
        replyType,
        timestamp,
        originalMessageId
      ]);

      const messageId = messageResult.insertId;

      // Insert content based on message type
      if (replyType === 'text') {
        const insertTextQuery = `
          INSERT INTO textmessage (MessageID, Content)
          VALUES (?, ?)
        `;
        await pool.execute(insertTextQuery, [messageId, replyContent]);
      } else if (replyType === 'attachment') {
        const insertAttachmentQuery = `
          INSERT INTO attachmentmessage (MessageID, Content, AttachmentUrl)
          VALUES (?, ?, ?)
        `;
        await pool.execute(insertAttachmentQuery, [messageId, replyContent, attachmentUrl]);
      } else {
        return {
          success: false,
          message: "Invalid message type"
        };
      }

      return {
        success: true,
        messageId: messageId,
        originalMessage: {
          messageId: originalMessage.MessageID,
          userId: originalMessage.UserID,
          type: originalMessage.Type,
          content: originalMessage.Content,
          attachmentUrl: originalMessage.AttachmentUrl,
          senderName: originalMessage.SenderName,
          timestamp: originalMessage.Timestamp
        },
        message: "Reply sent successfully"
      };
    } catch (error) {
      console.error("Error in replyToMessage:", error);
      throw error;
    }
  },

  forwardMessage: async (originalMessageId, targetChatId, userId) => {
    try {
      // Verify user is a member of the target chat
      const memberQuery = `
        SELECT COUNT(*) as isMember
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [memberCheck] = await pool.execute(memberQuery, [targetChatId, userId]);

      if (memberCheck[0].isMember === 0) {
        return {
          success: false,
          message: "You are not a member of the target chat"
        };
      }

      // Get the original message details
      const originalMessageQuery = `
        SELECT m.MessageID, m.UserID, m.Type, m.ChatID,
               CASE 
                 WHEN m.Type = 'text' THEN tm.Content
                 WHEN m.Type = 'attachment' THEN am.Content
                 ELSE NULL
               END as Content,
               CASE
                 WHEN m.Type = 'attachment' THEN am.AttachmentUrl
                 ELSE NULL
               END as AttachmentUrl
        FROM message m
        LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
        LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
        WHERE m.MessageID = ?
      `;
      const [originalMessages] = await pool.execute(originalMessageQuery, [originalMessageId]);

      if (originalMessages.length === 0) {
        return {
          success: false,
          message: "Original message not found"
        };
      }

      const originalMessage = originalMessages[0];

      // Verify user has access to the original message
      const sourceChatMemberQuery = `
        SELECT COUNT(*) as isMember
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [sourceMemberCheck] = await pool.execute(sourceChatMemberQuery, [originalMessage.ChatID, userId]);

      if (sourceMemberCheck[0].isMember === 0) {
        return {
          success: false,
          message: "You don't have access to the original message"
        };
      }

      const timestamp = new Date();

      // Create the new message as a forwarded message
      const insertMessageQuery = `
        INSERT INTO message (ChatID, UserID, Type, Timestamp, ForwardedFrom)
        VALUES (?, ?, ?, ?, ?)
      `;
      const [messageResult] = await pool.execute(insertMessageQuery, [
        targetChatId,
        userId,
        originalMessage.Type,
        timestamp,
        originalMessageId
      ]);

      const messageId = messageResult.insertId;

      // Insert content based on message type
      if (originalMessage.Type === 'text') {
        const insertTextQuery = `
          INSERT INTO textmessage (MessageID, Content)
          VALUES (?, ?)
        `;
        await pool.execute(insertTextQuery, [messageId, originalMessage.Content]);
      } else if (originalMessage.Type === 'attachment') {
        const insertAttachmentQuery = `
          INSERT INTO attachmentmessage (MessageID, Content, AttachmentUrl)
          VALUES (?, ?, ?)
        `;
        await pool.execute(insertAttachmentQuery, [messageId, originalMessage.Content, originalMessage.AttachmentUrl]);
      }

      return {
        success: true,
        messageId: messageId,
        message: "Message forwarded successfully"
      };
    } catch (error) {
      console.error("Error in forwardMessage:", error);
      throw error;
    }
  },

  getChatHistoryWithDeletions: async (chatId, count = 10, userId) => {
    try {
      if (!userId) {
        return {
          success: false,
          message: "User ID is required"
        };
      }

      // Check if user is a member of the chat
      const memberQuery = `
        SELECT COUNT(*) as isMember
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [memberCheck] = await pool.execute(memberQuery, [chatId, userId]);

      if (memberCheck[0].isMember === 0) {
        return {
          success: false,
          message: "You are not a member of this chat"
        };
      }

      // Get messages excluding those deleted by the user
      const messagesQuery = `
        SELECT m.MessageID, m.UserID, m.Type, m.Timestamp, m.Reactions, 
               m.replyTo, m.ForwardedFrom,
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
        LEFT JOIN message_deletions md ON m.MessageID = md.MessageID AND md.UserID = ?
        WHERE m.ChatID = ? AND md.MessageID IS NULL
        ORDER BY m.Timestamp DESC
        LIMIT ?
      `;

      const [messages] = await pool.execute(messagesQuery, [userId, chatId, count]);

      // Enrich messages with reply and forwarded info
      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        let replyToMessage = null;
        let forwardedFromMessage = null;

        // If this is a reply, get the original message
        if (msg.replyTo) {
          const replyQuery = `
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
            WHERE m.MessageID = ?
          `;
          const [replyResults] = await pool.execute(replyQuery, [msg.replyTo]);
          if (replyResults.length > 0) {
            replyToMessage = {
              messageId: replyResults[0].MessageID,
              userId: replyResults[0].UserID,
              type: replyResults[0].Type,
              timestamp: replyResults[0].Timestamp,
              content: replyResults[0].Content,
              attachmentUrl: replyResults[0].AttachmentUrl,
              senderName: replyResults[0].SenderName
            };
          }
        }

        // If this is forwarded, get the original message
        if (msg.ForwardedFrom) {
          const forwardQuery = `
            SELECT m.MessageID, m.UserID, m.Type, m.Timestamp, m.ChatID,
                   CASE 
                     WHEN m.Type = 'text' THEN tm.Content
                     WHEN m.Type = 'attachment' THEN am.Content
                     ELSE NULL
                   END as Content,
                   u.Name as SenderName
            FROM message m
            LEFT JOIN textmessage tm ON m.MessageID = tm.MessageID
            LEFT JOIN attachmentmessage am ON m.MessageID = am.MessageID
            JOIN user u ON m.UserID = u.UserID
            WHERE m.MessageID = ?
          `;
          const [forwardResults] = await pool.execute(forwardQuery, [msg.ForwardedFrom]);
          if (forwardResults.length > 0) {
            forwardedFromMessage = {
              messageId: forwardResults[0].MessageID,
              userId: forwardResults[0].UserID,
              senderName: forwardResults[0].SenderName
            };
          }
        }

        return {
          messageId: msg.MessageID,
          userId: msg.UserID,
          type: msg.Type,
          timestamp: msg.Timestamp,
          content: msg.Content,
          attachmentUrl: msg.AttachmentUrl,
          deleteReason: msg.DeleteReason,
          senderName: msg.SenderName,
          senderImage: msg.SenderImage,
          reactions: msg.Reactions ? JSON.parse(msg.Reactions) : [],
          replyTo: replyToMessage,
          forwardedFrom: forwardedFromMessage
        };
      }));

      return enrichedMessages;
    } catch (error) {
      console.error("Error in getChatHistoryWithDeletions:", error);
      throw error;
    }
  }
};

module.exports = chatModel;