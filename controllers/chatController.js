const ChatModel = require('../models/chatModel');
const { uploadFile } = require('../service');
const Controller = {};

Controller.getMainPath = async (req, res) => {
  res.status(200).send("Api is working");
};

Controller.getUserChats = async (req, res) => {
  try {
    const userId = req.query.userId; // Get userId from query parameter

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const userChats = await ChatModel.getUserChats(userId);

    return res.status(200).json({
      success: true,
      data: userChats
    });
  } catch (error) {
    console.error("Error fetching user chats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user chats",
      error: error.message
    });
  }
};

Controller.getChatInfo = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.query.userId;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required"
      });
    }

    const chatInfo = await ChatModel.getChatInfo(chatId, userId);

    if (!chatInfo) {
      return res.status(404).json({
        success: false,
        message: "Chat not found or you don't have access to this chat"
      });
    }

    return res.status(200).json({
      success: true,
      data: chatInfo
    });
  } catch (error) {
    console.error("Error fetching chat info:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat information",
      error: error.message
    });
  }
};

Controller.getChatHistory = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const count = Math.min(parseInt(req.params.count) || 10, 50);
    const userId = req.query.userId;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required"
      });
    }

    const messages = await ChatModel.getChatHistory(chatId, count, userId);

    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat history",
      error: error.message
    });
  }
};

Controller.searchMessages = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const query = req.query.query;
    const userId = req.query.userId;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID is required"
      });
    }

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const messages = await ChatModel.searchMessages(chatId, query, userId);

    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error("Error searching messages:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search messages",
      error: error.message
    });
  }
};

Controller.deleteMessage = async (req, res) => {
  try {
    const messageId = req.query.messageId;
    const deleteType = req.query.deleteType;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required"
      });
    }

    if (!deleteType) {
      return res.status(400).json({
        success: false,
        message: "Delete type is required"
      });
    }

    // Validate delete type
    if (deleteType !== 'remove' && deleteType !== 'unsent') {
      return res.status(400).json({
        success: false,
        message: "Invalid delete type. Must be 'remove' or 'unsent'"
      });
    }

    // Process the message deletion
    const result = await ChatModel.deleteMessage(messageId, deleteType);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    const app = req.app;
    if (app.locals.userConnections) {
      const messageObj = {
        type: "changeMessageType",
        msgId: messageId,
        deleteType: deleteType
      };
      app.locals.userConnections.forEach((ws, userId) => {
        if (ws.readyState === 1) { // WebSocket.OPEN = 1
          try {
            ws.send(JSON.stringify(messageObj));
            console.log(`Message status change notification sent to user ${userId}`);
          } catch (e) {
            console.error(`Error sending notification to user ${userId}:`, e);
          }
        }
      });

    }

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete message",
      error: error.message
    });
  }
};

Controller.getOrCreatePrivateChat = async (req, res) => {
  try {
    const { userIdA, userIdB } = req.query;
    
    if (!userIdA || !userIdB) {
      return res.status(400).json({
        success: false,
        message: "Both user IDs are required"
      });
    }
    
    const result = await ChatModel.getOrCreatePrivateChat(userIdA, userIdB);
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error getting or creating private chat:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get or create private chat",
      error: error.message
    });
  }
};
module.exports = Controller;