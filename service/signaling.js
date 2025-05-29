const socketIo = require('socket.io');
const CallModel = require('../models/callModel');

// Map to store user socket connections
const userSocketMap = new Map();
// Map to store active calls
const activeCallsMap = new Map();

function setupSignalingServer(server) {
  const io = socketIo(server, {
    cors: {
      origin: '*', // In production, restrict this to your frontend domain
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // User registers their socket
    socket.on('register', (userId) => {
      userSocketMap.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // Handle call initiation
    socket.on('call-user', async (data) => {
      const { callerId, callerName, callerImage, receiverId, callType, callId, signal } = data;
      console.log(`Call initiation: ${callerId} -> ${receiverId} (${callType}) with ID: ${callId}`);
      
      // Store call information
      activeCallsMap.set(callId, { callerId, receiverId });
      
      const receiverSocketId = userSocketMap.get(receiverId);
      if (receiverSocketId) {
        // Notify the receiver about the incoming call
        io.to(receiverSocketId).emit('incoming-call', {
          callerId,
          callerName,
          callerImage,
          callType,
          callId,
          signal
        });
        console.log(`Incoming call notification sent to ${receiverId}`);
      } else {
        // Receiver is not online, notify caller
        socket.emit('call-response', {
          callId,
          status: 'failed',
          message: 'User is not online'
        });
        console.log(`Call failed: receiver ${receiverId} is not online`);
        
        try {
          await CallModel.updateCallStatus(callId, 'missed', true);
        } catch (error) {
          console.error(`Error updating call status: ${error.message}`);
        }
      }
    });

    // Handle call acceptance
    socket.on('accept-call', (data) => {
      const { callId, callerId, receiverId, signal } = data;
      console.log(`Call accepted: ${callId} by ${receiverId} for caller ${callerId}`);
      
      const callerSocketId = userSocketMap.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-accepted', {
          callId,
          receiverId,
          signal
        });
        console.log(`Call acceptance notification sent to ${callerId}`);
        
        try {
          CallModel.updateCallStatus(callId, 'connected');
        } catch (error) {
          console.error(`Error updating call status: ${error.message}`);
        }
      } else {
        console.log(`Cannot notify caller ${callerId} - not online`);
        socket.emit('call-response', {
          callId,
          status: 'failed',
          message: 'Caller is no longer online'
        });
      }
    });

    // Handle call rejection
    socket.on('reject-call', async (data) => {
      const { callId, callerId } = data;
      console.log(`Call rejected: ${callId} from ${callerId}`);
      
      const callerSocketId = userSocketMap.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-rejected', { callId });
      }
      
      try {
        await CallModel.updateCallStatus(callId, 'rejected', true);
      } catch (error) {
        console.error(`Error updating call status: ${error.message}`);
      }
    });

    // Handle ICE candidates exchange - THIS IS THE CRITICAL FIX
    socket.on('ice-candidate', (data) => {
      const { userId, callId, candidate } = data;
      console.log(`ICE candidate for call ${callId} to user ${userId}:`, candidate);
      
      const userSocketId = userSocketMap.get(userId);
      if (userSocketId) {
        // Make sure to include the callId when forwarding the candidate
        io.to(userSocketId).emit('ice-candidate', { 
          callId, 
          candidate 
        });
        console.log(`ICE candidate sent to ${userId}`);
      } else {
        console.log(`Cannot send ICE candidate - user ${userId} not online`);
      }
    });

    // Handle call end
    socket.on('end-call', async (data) => {
      const { callId, userId } = data;
      console.log(`Call ended: ${callId} by user ${userId}`);
      
      // Get the call data to notify the other participant
      const callData = activeCallsMap.get(callId);
      if (callData) {
        const otherUserId = callData.callerId === userId ? callData.receiverId : callData.callerId;
        const otherUserSocketId = userSocketMap.get(otherUserId);
        
        if (otherUserSocketId) {
          io.to(otherUserSocketId).emit('call-ended', { callId });
          console.log(`Call end notification sent to ${otherUserId}`);
        }
        
        // Clean up call data
        activeCallsMap.delete(callId);
      }
      
      try {
        await CallModel.updateCallStatus(callId, 'completed', true);
      } catch (error) {
        console.error(`Error updating call status: ${error.message}`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      let disconnectedUserId = null;
      
      // Find which user disconnected
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          disconnectedUserId = userId;
          userSocketMap.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
      
      // Handle any active calls for the disconnected user
      if (disconnectedUserId) {
        for (const [callId, callData] of activeCallsMap.entries()) {
          if (callData.callerId === disconnectedUserId || callData.receiverId === disconnectedUserId) {
            const otherUserId = callData.callerId === disconnectedUserId ? callData.receiverId : callData.callerId;
            const otherUserSocketId = userSocketMap.get(otherUserId);
            
            if (otherUserSocketId) {
              io.to(otherUserSocketId).emit('call-ended', { 
                callId, 
                reason: 'user_disconnected' 
              });
              console.log(`Call ${callId} ended due to user ${disconnectedUserId} disconnection`);
            }
            
            activeCallsMap.delete(callId);
            
            try {
              CallModel.updateCallStatus(callId, 'disconnected', true);
            } catch (error) {
              console.error(`Error updating call status: ${error.message}`);
            }
          }
        }
      }
    });
  });

  return io;
}

module.exports = setupSignalingServer;