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
    const { chatId, count } = req.params;
    const userId = req.user.id;

    const messages = await ChatModel.getChatHistoryWithDeletions(chatId, parseInt(count), userId);

    if (messages.success === false) {
      return res.status(403).json(messages);
    }

    return res.json(messages);
  } catch (error) {
    console.error("Error in getChatHistory controller:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching chat history"
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

Controller.searchChatsByName = async (req, res) => {
  try {
    const userId = req.query.userId;
    const searchQuery = req.query.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const chats = await ChatModel.searchChatsByName(userId, searchQuery);
    return res.status(200).json({
      success: true,
      data: chats
    });
  } catch (error) {
    console.error("Error searching chats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search chats",
      error: error.message
    });
  }
};

Controller.deleteMessage = async (req, res) => {
  try {
    const { messageId, deleteType } = req.body;
    const userId = req.user.id;

    if (!messageId || !deleteType) {
      return res.status(400).json({
        success: false,
        message: "Message ID and delete type are required"
      });
    }

    const result = await ChatModel.deleteMessage(messageId, deleteType, userId);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in deleteMessage controller:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting message"
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

Controller.replyToMessage = async (req, res) => {
  try {
    const { chatId, originalMessageId, content, type, attachmentUrl } = req.body;
    const userId = req.user.id;

    if (!chatId || !originalMessageId || !content) {
      return res.status(400).json({
        success: false,
        message: "Chat ID, original message ID, and content are required"
      });
    }

    const result = await ChatModel.replyToMessage(
      chatId,
      userId,
      originalMessageId,
      content,
      type || 'text',
      attachmentUrl
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in replyToMessage controller:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while replying to message"
    });
  }
};

Controller.forwardMessage = async (req, res) => {
  try {
    const { originalMessageId, targetChatId } = req.body;
    const userId = req.user.id;

    if (!originalMessageId || !targetChatId) {
      return res.status(400).json({
        success: false,
        message: "Original message ID and target chat ID are required"
      });
    }

    const result = await ChatModel.forwardMessage(
      originalMessageId,
      targetChatId,
      userId
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in forwardMessage controller:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while forwarding message"
    });
  }
};

module.exports = Controller;