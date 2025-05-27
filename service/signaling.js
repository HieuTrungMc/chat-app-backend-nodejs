const socketIo = require('socket.io');
const CallModel = require('../models/callModel');

// Map to store user socket connections
const userSocketMap = new Map();

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
            const { callerId, receiverId, callType, callId } = data;
            const receiverSocketId = userSocketMap.get(receiverId);

            if (receiverSocketId) {
                // Notify the receiver about the incoming call
                io.to(receiverSocketId).emit('incoming-call', {
                    callId,
                    callerId,
                    callType,
                    signal: data.signal
                });
            } else {
                // Receiver is not online, notify caller
                socket.emit('call-response', {
                    callId,
                    status: 'failed',
                    message: 'User is not online'
                });
                
                // Update call status to missed
                await CallModel.updateCallStatus(callId, 'missed', true);
            }
        });

        // Handle call acceptance
        socket.on('accept-call', (data) => {
            const { callId, callerId, signal } = data;
            const callerSocketId = userSocketMap.get(callerId);

            if (callerSocketId) {
                io.to(callerSocketId).emit('call-accepted', {
                    callId,
                    signal
                });
                
                // Update call status to connected
                CallModel.updateCallStatus(callId, 'connected');
            }
        });

        // Handle call rejection
        socket.on('reject-call', async (data) => {
            const { callId, callerId } = data;
            const callerSocketId = userSocketMap.get(callerId);

            if (callerSocketId) {
                io.to(callerSocketId).emit('call-rejected', { callId });
            }
            
            // Update call status to rejected
            await CallModel.updateCallStatus(callId, 'rejected', true);
        });

        // Handle ICE candidates exchange
        socket.on('ice-candidate', (data) => {
            const { userId, candidate } = data;
            const userSocketId = userSocketMap.get(userId);

            if (userSocketId) {
                io.to(userSocketId).emit('ice-candidate', { candidate });
            }
        });

        // Handle call end
        socket.on('end-call', async (data) => {
            const { callId, userId } = data;
            const userSocketId = userSocketMap.get(userId);

            if (userSocketId) {
                io.to(userSocketId).emit('call-ended', { callId });
            }
            
            // Update call status to completed
            await CallModel.updateCallStatus(callId, 'completed', true);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            // Remove user from socket map
            for (const [userId, socketId] of userSocketMap.entries()) {
                if (socketId === socket.id) {
                    userSocketMap.delete(userId);
                    console.log(`User ${userId} disconnected`);
                    break;
                }
            }
        });
    });

    return io;
}

module.exports = setupSignalingServer;