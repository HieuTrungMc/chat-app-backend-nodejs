const GroupChatModel = require('../models/groupChatModel');
const Controller = {};

Controller.createGroup = async (req, res) => {
  try {
    const { name, image, ownerId, initialMembers } = req.body;

    if (!name || !ownerId) {
      return res.status(400).json({
        success: false,
        message: "Group name and owner ID are required"
      });
    }

    const result = await GroupChatModel.createGroup(name, image, ownerId, initialMembers || []);

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error creating group:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create group",
      error: error.message
    });
  }
};

Controller.addMember = async (req, res) => {
  try {
    const { chatId, userId, newMemberId, role } = req.body;

    if (!chatId || !userId || !newMemberId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID, user ID, and new member ID are required"
      });
    }

    const result = await GroupChatModel.addMember(chatId, userId, newMemberId, role || 'member');

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error adding member:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add member",
      error: error.message
    });
  }
};

Controller.removeMember = async (req, res) => {
  try {
    const { chatId, userId, memberToRemoveId } = req.body;

    if (!chatId || !userId || !memberToRemoveId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID, user ID, and member to remove ID are required"
      });
    }

    const result = await GroupChatModel.removeMember(chatId, userId, memberToRemoveId);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error removing member:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove member",
      error: error.message
    });
  }
};

Controller.changeRole = async (req, res) => {
  try {
    const { chatId, userId, memberToChangeId, newRole } = req.body;

    if (!chatId || !userId || !memberToChangeId || !newRole) {
      return res.status(400).json({
        success: false,
        message: "Chat ID, user ID, member to change ID, and new role are required"
      });
    }

    const result = await GroupChatModel.changeRole(chatId, userId, memberToChangeId, newRole);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error changing role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change role",
      error: error.message
    });
  }
};

Controller.disbandGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and user ID are required"
      });
    }

    const result = await GroupChatModel.disbandGroup(chatId, userId);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error disbanding group:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to disband group",
      error: error.message
    });
  }
};

Controller.getGroupMembers = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.query.userId;

    if (!chatId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and user ID are required"
      });
    }

    const result = await GroupChatModel.getGroupMembers(chatId, userId);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error getting group members:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get group members",
      error: error.message
    });
  }
};

Controller.leaveGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and user ID are required"
      });
    }

    const result = await GroupChatModel.leaveGroup(chatId, userId);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error leaving group:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to leave group",
      error: error.message
    });
  }
};

Controller.renameGroup = async (req, res) => {
  try {
    const { chatId, userId, newName } = req.body;

    if (!chatId || !userId || !newName) {
      return res.status(400).json({
        success: false,
        message: "Chat ID, user ID, and new name are required"
      });
    }

    const result = await GroupChatModel.renameGroup(chatId, userId, newName);

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error renaming group:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to rename group",
      error: error.message
    });
  }
};

module.exports = Controller;