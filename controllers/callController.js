const { pool } = require('../utils/aws-helper');
const { v4: uuidv4 } = require('uuid');
const CallModel = require('../models/callModel');

exports.initiateCall = async (req, res) => {
  try {
    const { callerId, receiverId, callType } = req.body;

    if (!callerId || !receiverId || !callType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate call type
    if (callType !== 'audio' && callType !== 'video') {
      return res.status(400).json({ message: 'Invalid call type. Must be audio or video' });
    }

    // Generate a unique call ID
    const callId = uuidv4();

    // Store call information in database
    await CallModel.createCall(callId, callerId, receiverId, callType);

    return res.status(201).json({
      callId,
      message: 'Call initiated successfully'
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getCallHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Get call history for the user (both as caller and receiver)
    const calls = await CallModel.getCallHistory(userId);

    return res.status(200).json(calls);
  } catch (error) {
    console.error('Error getting call history:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};