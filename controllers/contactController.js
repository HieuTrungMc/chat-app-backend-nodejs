const ContactModel = require('../models/contactModel');
const Controller = {};


Controller.listContacts = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const contacts = await ContactModel.listContacts(userId);

    return res.status(200).json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
      error: error.message
    });
  }
};


Controller.findByPhone = async (req, res) => {
  try {
    const phone = req.query.phone;
    const userId = req.query.userId;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const users = await ContactModel.findByPhone(phone, userId);

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error("Error finding users by phone:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to find users",
      error: error.message
    });
  }
};


Controller.findByName = async (req, res) => {
  try {
    const name = req.query.name;
    const userId = req.query.userId;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const users = await ContactModel.findByName(name, userId);

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error("Error finding users by name:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to find users",
      error: error.message
    });
  }
};


Controller.addContact = async (req, res) => {
  try {
    const userId = req.query.userId;
    const contactId = req.query.contactId;

    if (!userId || !contactId) {
      return res.status(400).json({
        success: false,
        message: "Both user ID and contact ID are required"
      });
    }

    const result = await ContactModel.addContact(userId, contactId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error("Error adding contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add contact",
      error: error.message
    });
  }
};


Controller.listRequests = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const requests = await ContactModel.listRequests(userId);

    return res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error("Error fetching friend requests:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch friend requests",
      error: error.message
    });
  }
};


Controller.acceptRequest = async (req, res) => {
  try {
    const userId = req.query.userId;
    const senderId = req.query.senderId;

    if (!userId || !senderId) {
      return res.status(400).json({
        success: false,
        message: "Both user ID and sender ID are required"
      });
    }

    const result = await ContactModel.acceptRequest(userId, senderId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to accept friend request",
      error: error.message
    });
  }
};


Controller.denyRequest = async (req, res) => {
  try {
    const userId = req.query.userId;
    const senderId = req.query.senderId;

    if (!userId || !senderId) {
      return res.status(400).json({
        success: false,
        message: "Both user ID and sender ID are required"
      });
    }

    const result = await ContactModel.denyRequest(userId, senderId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error("Error denying friend request:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to deny friend request",
      error: error.message
    });
  }
};

Controller.listSentRequests = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const sentRequests = await ContactModel.listSentRequests(userId);

    return res.status(200).json({
      success: true,
      data: sentRequests
    });
  } catch (error) {
    console.error("Error fetching sent friend requests:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sent friend requests",
      error: error.message
    });
  }
};

Controller.unfriendContact = async (req, res) => {
  try {
    const userId = req.query.userId;
    const contactId = req.query.contactId;

    if (!userId || !contactId) {
      return res.status(400).json({
        success: false,
        message: "Both user ID and contact ID are required"
      });
    }

    const result = await ContactModel.unfriendContact(userId, contactId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error("Error unfriending contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unfriend contact",
      error: error.message
    });
  }
};

Controller.blockContact = async (req, res) => {
  try {
    const userId = req.query.userId;
    const contactId = req.query.contactId;

    if (!userId || !contactId) {
      return res.status(400).json({
        success: false,
        message: "Both user ID and contact ID are required"
      });
    }

    const result = await ContactModel.blockContact(userId, contactId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error("Error blocking contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to block contact",
      error: error.message
    });
  }
};

Controller.unblockContact = async (req, res) => {
  try {
    const userId = req.query.userId;
    const contactId = req.query.contactId;

    if (!userId || !contactId) {
      return res.status(400).json({
        success: false,
        message: "Both user ID and contact ID are required"
      });
    }

    const result = await ContactModel.unblockContact(userId, contactId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error("Error unblocking contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to unblock contact",
      error: error.message
    });
  }
};

module.exports = Controller;