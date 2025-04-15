const mysql = require('mysql2');
require('dotenv').config()

const dbConnection = mysql.createConnection({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE
});

module.exports = (app) => {
  const userConnections = new Map();

  
  app.locals.userConnections = userConnections;

  app.ws('/ws', (ws, req) => {
    console.log('WebSocket connection established');

    ws.on('message', (message) => {
      try {
        const packet = JSON.parse(message);
        console.log(`Received message type: ${packet.type}`, packet);

        switch (packet.type) {
          case 'joinSocket': {
            let { userID } = packet;
            userID = Number(userID);

            const existingConnection = userConnections.get(userID);
            if (existingConnection && existingConnection !== ws) {
              console.log(`User ${userID} already has a connection. Closing previous connection.`);
              try {
                existingConnection.send(JSON.stringify({
                  type: 'connectionReplaced',
                  message: 'Your connection was replaced by a new session'
                }));
                existingConnection.close();
              } catch (e) {
                console.error('Error closing previous connection:', e);
              }
            }

            userConnections.set(userID, ws);
            ws.userID = userID;
            console.log('Current active connections:', Array.from(userConnections.keys()));

            ws.send(JSON.stringify({ type: 'ok', originalType: 'joinSocket' }));
            console.log(`User ${userID} connected with a new session`);
            break;
          }
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }
          case 'joinChat': {
            const { chatId } = packet;
            const userId = ws.userID;
            dbConnection.query('SELECT * FROM chat WHERE ChatID = ?', [chatId], (err, results) => {
              if (err) {
                console.error(err);
                ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'joinChat' }));
                return;
              }

              if (results.length > 0) {
                dbConnection.query('SELECT * FROM chatmember WHERE ChatID = ? AND UserID = ?', [chatId, userId], (err, memberResults) => {
                  if (err) {
                    console.error(err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'joinChat' }));
                    return;
                  }

                  if (memberResults.length === 0) {
                    dbConnection.query(
                        'INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp) VALUES (?, ?, ?, ?)',
                        [chatId, userId, 'member', new Date()],
                        (err) => {
                          if (err) {
                            console.error(err);
                            ws.send(JSON.stringify({ type: 'error', message: 'Error adding user to chat', originalType: 'joinChat' }));
                            return;
                          }

                          ws.send(JSON.stringify({ type: 'ok', originalType: 'joinChat', chatId: chatId }));
                        }
                    );
                  } else {
                    ws.send(JSON.stringify({ type: 'ok', originalType: 'joinChat', chatId: chatId }));
                  }
                });
              } else {
                const peerUserId = chatId;

                const compositeChatId = [userId, peerUserId].sort().join('-');

                dbConnection.query('SELECT * FROM chat WHERE ChatID = ?', [compositeChatId], (err, chatResults) => {
                  if (err) {
                    console.error(err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'joinChat' }));
                    return;
                  }

                  if (chatResults.length === 0) {
                    dbConnection.query(
                        'INSERT INTO chat (ChatID, CreatedDate, Type, Status, Owner) VALUES (?, ?, ?, ?, ?)',
                        [compositeChatId, new Date(), 'private', 'active', userId],
                        (err) => {
                          if (err) {
                            console.error(err);
                            ws.send(JSON.stringify({ type: 'error', message: 'Error creating chat', originalType: 'joinChat' }));
                            return;
                          }
                          dbConnection.query(
                              'INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
                              [compositeChatId, userId, 'member', new Date(), compositeChatId, peerUserId, 'member', new Date()],
                              (err) => {
                                if (err) {
                                  console.error(err);
                                  ws.send(JSON.stringify({ type: 'error', message: 'Error adding chat members', originalType: 'joinChat' }));
                                  return;
                                }

                                ws.send(JSON.stringify({ type: 'ok', originalType: 'joinChat', chatId: compositeChatId }));
                              }
                          );
                        }
                    );
                  } else {
                    ws.send(JSON.stringify({ type: 'ok', originalType: 'joinChat', chatId: compositeChatId }));
                  }
                });
              }
            });
            break;
          }
          case 'sendChat': {
            const { chatId, messagePayload } = packet;
            const userId = ws.userID;

            if (!userId) {
              console.error('User ID not found for this connection');
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated, please reconnect', originalType: 'sendChat' }));
              return;
            }

            dbConnection.query(
                'SELECT c.*, cm.UserID FROM chat c JOIN chatmember cm ON c.ChatID = cm.ChatID WHERE c.ChatID = ? AND cm.UserID = ?',
                [chatId, userId],
                (err, chatResults) => {
                  if (err) {
                    console.error(err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'sendChat' }));
                    return;
                  }

                  if (chatResults.length === 0) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Chat not found or you are not a member', originalType: 'sendChat' }));
                    return;
                  }

                  const { type, content } = messagePayload;
                  const timestamp = new Date();

                  dbConnection.query(
                      'INSERT INTO message (ChatID, UserID, Type, Timestamp) VALUES (?, ?, ?, ?)',
                      [chatId, userId, type, timestamp],
                      (err, results) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Error sending message', originalType: 'sendChat' }));
                          return;
                        }

                        const messageId = results.insertId;

                        if (type === 'text') {
                          dbConnection.query(
                              'INSERT INTO textmessage (MessageID, Content) VALUES (?, ?)',
                              [messageId, content],
                              (err) => {
                                if (err) {
                                  console.error(err);
                                  ws.send(JSON.stringify({ type: 'error', message: 'Error storing message content', originalType: 'sendChat' }));
                                  return;
                                }
                                messagePayload.messageId = messageId
                                ws.send(JSON.stringify({
                                  type: 'ok',
                                  originalType: 'sendChat',
                                  messageId: messageId,
                                  messagePayload: messagePayload
                                }));
                                dbConnection.query(
                                    'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
                                    [chatId, userId],
                                    (err, memberResults) => {
                                      if (err) {
                                        console.error(err);
                                        return;
                                      }

                                      console.log(`Found ${memberResults.length} other members to notify`);

                                      
                                      memberResults.forEach(member => {
                                        const memberId = member.UserID;
                                        console.log(`Attempting to send message to user: ${memberId}`);

                                        const targetWs = userConnections.get(memberId);
                                        

                                        if (targetWs && targetWs.readyState === 1) { 
                                          console.log(`Connection found for user ${memberId}, sending message`);

                                          const messagePacket = {
                                            type: 'receiveChat',
                                            chatId: chatId,
                                            message: {
                                              messageId,
                                              type,
                                              content,
                                              senderId: userId,
                                              timestamp: timestamp
                                            }
                                          };

                                          try {
                                            targetWs.send(JSON.stringify(messagePacket));
                                            console.log(`Message sent successfully to user ${memberId}`);
                                          } catch (e) {
                                            console.error(`Error sending message to user ${memberId}:`, e);
                                            
                                            
                                            userConnections.delete(memberId);
                                          }
                                        } else {
                                          console.log(`No active connection found for user ${memberId} or connection not open`);
                                          if (targetWs) {
                                            console.log(`Connection state: ${targetWs.readyState}`);
                                          }
                                        }
                                      });
                                    }
                                );
                              }
                          );
                        } else if (type === 'attachment') {
                          const { attachmentUrl } = messagePayload;
                          dbConnection.query(
                              'INSERT INTO attachmentmessage (MessageID, Content, AttachmentUrl) VALUES (?, ?, ?)',
                              [messageId, content, attachmentUrl],
                              (err) => {
                                if (err) {
                                  console.error(err);
                                  ws.send(JSON.stringify({ type: 'error', message: 'Error storing message content', originalType: 'sendChat' }));
                                  return;
                                }
                                messagePayload.messageId = messageId
                                
                                ws.send(JSON.stringify({
                                  type: 'ok',
                                  originalType: 'sendChat',
                                  messageId: messageId,
                                  messagePayload: messagePayload
                                }));

                                
                                dbConnection.query(
                                    'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
                                    [chatId, userId],
                                    (err, memberResults) => {
                                      if (err) {
                                        console.error(err);
                                        return;
                                      }

                                      console.log(`Found ${memberResults.length} other members to notify for attachment`);

                                      
                                      memberResults.forEach(member => {
                                        const memberId = member.UserID
                                        console.log(`Attempting to send attachment message to user: ${memberId}`);

                                        const targetWs = userConnections.get(memberId);

                                        if (targetWs && targetWs.readyState === 1) {
                                          console.log(`Connection found for user ${memberId}, sending attachment message`);

                                          try {
                                            targetWs.send(JSON.stringify({
                                              type: 'receiveChat',
                                              chatId: chatId,
                                              message: {
                                                messageId,
                                                type,
                                                content,
                                                attachmentUrl,
                                                senderId: userId,
                                                timestamp: timestamp
                                              }
                                            }));
                                            console.log(`Attachment message sent successfully to user ${memberId}`);
                                          } catch (e) {
                                            console.error(`Error sending attachment message to user ${memberId}:`, e);
                                            userConnections.delete(memberId);
                                          }
                                        } else {
                                          console.log(`No active connection found for user ${memberId} or connection not open`);
                                        }
                                      });
                                    }
                                );
                              }
                          );
                        } else {
                          console.log('Unknown message type:', type);
                          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type', originalType: 'sendChat' }));
                        }
                      }
                  );
                }
            );
            break;
          }
          default:
            console.log('Unknown packet type:', packet.type);
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown packet type', originalType: packet.type }));
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      
    });

    ws.on('close', () => {
      
      if (ws.userID && userConnections.get(ws.userID) === ws) {
        userConnections.delete(ws.userID);
        console.log(`User ${ws.userID} disconnected`);
        console.log('Remaining active connections:', Array.from(userConnections.keys()));
      }
    });

    
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) { 
        try {
          ws.send(JSON.stringify({ type: 'pong' }));
        } catch (e) {
          console.error('Error sending ping:', e);
          clearInterval(pingInterval);
        }
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); 

    
    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  
  setInterval(() => {
    console.log('Checking for stale connections...');
    userConnections.forEach((ws, userId) => {
      if (ws.readyState !== 1) { 
        console.log(`Removing stale connection for user ${userId}`);
        userConnections.delete(userId);
      }
    });
    console.log(`Active connections after cleanup: ${userConnections.size}`);
  }, 60000); 

  console.log('WebSocket server initialized at /ws');
};