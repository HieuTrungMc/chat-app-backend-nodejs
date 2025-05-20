const mysql = require('mysql2');
require('dotenv').config()

const dbConnection = mysql.createConnection({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DATABASE
});

// Helper function to notify group members
const notifyGroupMembers = async (app, chatId, userId, notificationType, data) => {
  try {
    // Get all members of the group except the sender
    dbConnection.query(
      'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
      [chatId, userId],
      (err, memberResults) => {
        if (err) {
          console.error('Error fetching group members:', err);
          return;
        }

        console.log(`Found ${memberResults.length} members to notify about ${notificationType}`);

        // Send notification to each member
        memberResults.forEach(member => {
          const memberId = member.UserID;
          const userConnections = app.locals.userConnections.get(memberId);

          if (userConnections && userConnections.size > 0) {
            console.log(`Sending ${notificationType} to ${userConnections.size} connections of user ${memberId}`);
            
            const deadConnections = [];
            userConnections.forEach(conn => {
              if (conn.readyState === 1) { // WebSocket.OPEN = 1
                try {
                  conn.send(JSON.stringify({
                type: notificationType,
                chatId: chatId,
                userId: userId,
                ...data
              }));
            } catch (e) {
                  console.error(`Error sending notification to a connection of user ${memberId}:`, e);
                  deadConnections.push(conn);
            }
                    } else {
                deadConnections.push(conn);
              }
            });
            
            // Clean up dead connections
            if (deadConnections.length > 0) {
              deadConnections.forEach(conn => userConnections.delete(conn));
              console.log(`Removed ${deadConnections.length} dead connections for user ${memberId}`);
              
              // If no connections left, remove the user from the map
              if (userConnections.size === 0) {
                app.locals.userConnections.delete(memberId);
                console.log(`Removed user ${memberId} from connections map (no active connections)`);
              }
            }
          }
        });
      }
                );
      } catch (error) {
    console.error('Error in notifyGroupMembers:', error);
      }
};

// Helper function to send message to a user's connections
const sendToUserConnections = (app, userId, message) => {
  const userConnections = app.locals.userConnections.get(userId);

  if (!userConnections || userConnections.size === 0) {
    return 0; // No connections
  }

  let sentCount = 0;
  const deadConnections = [];

  userConnections.forEach(conn => {
    if (conn.readyState === 1) { // WebSocket.OPEN = 1
      try {
        conn.send(JSON.stringify(message));
        sentCount++;
      } catch (e) {
        console.error(`Error sending message to a connection of user ${userId}:`, e);
        deadConnections.push(conn);
      }
    } else {
      deadConnections.push(conn);
    }
  });

  // Clean up dead connections
  if (deadConnections.length > 0) {
    deadConnections.forEach(conn => userConnections.delete(conn));
    console.log(`Removed ${deadConnections.length} dead connections for user ${userId}`);

    // If no connections left, remove the user from the map
    if (userConnections.size === 0) {
      app.locals.userConnections.delete(userId);
      console.log(`Removed user ${userId} from connections map (no active connections)`);
    }
  }

  return sentCount;
};

module.exports = (app) => {
  // Change to Map of userId -> Set of WebSocket connections
  const userConnections = new Map(); // userId -> Set<WebSocket>

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

            // Store the userID in the WebSocket object for reference
            ws.userID = userID;

            // Add this connection to the user's set of connections
            if (!userConnections.has(userID)) {
              userConnections.set(userID, new Set());
            }
            userConnections.get(userID).add(ws);

            console.log(`User ${userID} connected with a new session`);
            console.log(`User ${userID} now has ${userConnections.get(userID).size} active connections`);
            console.log('Current active users:', Array.from(userConnections.keys()));

            ws.send(JSON.stringify({ type: 'ok', originalType: 'joinSocket' }));
            break;
          }
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }
          case 'createGroup': {
            const { name, description, initialMembers } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'createGroup' }));
              return;
            }

            if (!name) {
              ws.send(JSON.stringify({ type: 'error', message: 'Group name is required', originalType: 'createGroup' }));
              return;
            }

            // Generate a unique chat ID
            const chatId = `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const createdDate = new Date();

            // Create the group chat
            dbConnection.query(
              'INSERT INTO chat (ChatID, CreatedDate, Type, Status, Owner) VALUES (?, ?, ?, ?, ?)',
              [chatId, createdDate, 'group', 'active', userId],
              (err) => {
                if (err) {
                  console.error(err);
                  ws.send(JSON.stringify({ type: 'error', message: 'Error creating group', originalType: 'createGroup' }));
                  return;
                }

                // Add the owner as a member with 'admin' role
                dbConnection.query(
                  'INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp) VALUES (?, ?, ?, ?)',
                  [chatId, userId, 'admin', createdDate],
                  (err) => {
                    if (err) {
                      console.error(err);
                      ws.send(JSON.stringify({ type: 'error', message: 'Error adding owner to group', originalType: 'createGroup' }));
                      return;
                    }

                    // Add initial members if provided
                    if (initialMembers && initialMembers.length > 0) {
                      const memberValues = initialMembers.map(memberId => [chatId, memberId, 'member', createdDate]);

                      dbConnection.query(
                        'INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp) VALUES ?',
                        [memberValues],
                        (err) => {
                          if (err) {
                            console.error(err);
                            ws.send(JSON.stringify({ type: 'error', message: 'Error adding members to group', originalType: 'createGroup' }));
                            return;
                          }

                          // Notify the creator
                          ws.send(JSON.stringify({
                            type: 'ok',
                            originalType: 'createGroup',
                            chatId: chatId,
                            name: name,
                            description: description
                          }));

                          // Notify the members
                          notifyGroupMembers(app, chatId, userId, 'groupCreated', {
                            name: name,
                            description: description,
                            createdBy: userId
                          });
                        }
                      );
                    } else {
                      // Notify the creator
                      ws.send(JSON.stringify({
                        type: 'ok',
                        originalType: 'createGroup',
                        chatId: chatId,
                        name: name,
                        description: description
                      }));
                    }
                  }
                );
              }
            );
            break;
          }
          case 'addGroupMember': {
            const { chatId, newMemberId } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'addGroupMember' }));
              return;
            }

            if (!chatId || !newMemberId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Chat ID and new member ID are required', originalType: 'addGroupMember' }));
              return;
            }

            // Check if the user is an admin of the group
            dbConnection.query(
              'SELECT Role FROM chatmember WHERE ChatID = ? AND UserID = ?',
              [chatId, userId],
              (err, adminCheck) => {
                if (err) {
                  console.error(err);
                  ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'addGroupMember' }));
                  return;
                }

                if (adminCheck.length === 0 || adminCheck[0].Role !== 'admin') {
                  ws.send(JSON.stringify({ type: 'error', message: 'You don\'t have permission to add members', originalType: 'addGroupMember' }));
                  return;
                }

                // Check if the chat is a group
                dbConnection.query(
                  'SELECT Type FROM chat WHERE ChatID = ?',
                  [chatId],
                  (err, chatType) => {
                    if (err) {
                      console.error(err);
                      ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'addGroupMember' }));
                      return;
                    }

                    if (chatType.length === 0 || chatType[0].Type !== 'group') {
                      ws.send(JSON.stringify({ type: 'error', message: 'This is not a group chat', originalType: 'addGroupMember' }));
                      return;
                    }

                    // Check if the member is already in the group
                    dbConnection.query(
                      'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID = ?',
                      [chatId, newMemberId],
                      (err, memberCheck) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'addGroupMember' }));
                          return;
                        }

                        if (memberCheck.length > 0) {
                          ws.send(JSON.stringify({ type: 'error', message: 'User is already a member of this group', originalType: 'addGroupMember' }));
                          return;
                        }

                        // Add the new member
                        dbConnection.query(
                          'INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp) VALUES (?, ?, ?, ?)',
                          [chatId, newMemberId, 'member', new Date()],
                          (err) => {
                            if (err) {
                              console.error(err);
                              ws.send(JSON.stringify({ type: 'error', message: 'Error adding member to group', originalType: 'addGroupMember' }));
                              return;
                            }

                            // Notify the admin
                            ws.send(JSON.stringify({
                              type: 'ok',
                              originalType: 'addGroupMember',
                              chatId: chatId,
                              newMemberId: newMemberId
                            }));

                            // Notify the group members
                            notifyGroupMembers(app, chatId, userId, 'memberAdded', {
                              newMemberId: newMemberId,
                              addedBy: userId
                            });

                            // Notify the new member if they're online
                            const message = {
                              type: 'addedToGroup',
                              chatId: chatId,
                              addedBy: userId
                            };

                            const sentCount = sendToUserConnections(app, newMemberId, message);
                            if (sentCount > 0) {
                              console.log(`Notified ${sentCount} connections of user ${newMemberId} about being added to group ${chatId}`);
                            }
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
            break;
          }
          case 'removeGroupMember': {
            const { chatId, memberToRemoveId } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'removeGroupMember' }));
              return;
            }

            if (!chatId || !memberToRemoveId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Chat ID and member ID are required', originalType: 'removeGroupMember' }));
              return;
            }

            // Check if the user is an admin of the group or is removing themselves
            dbConnection.query(
              'SELECT Role FROM chatmember WHERE ChatID = ? AND UserID = ?',
              [chatId, userId],
              (err, adminCheck) => {
                if (err) {
                  console.error(err);
                  ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'removeGroupMember' }));
                  return;
                }

                if (adminCheck.length === 0) {
                  ws.send(JSON.stringify({ type: 'error', message: 'You are not a member of this group', originalType: 'removeGroupMember' }));
                  return;
                }

                const isAdmin = adminCheck[0].Role === 'admin';
                const isSelfRemoval = userId === memberToRemoveId;

                if (!isAdmin && !isSelfRemoval) {
                  ws.send(JSON.stringify({ type: 'error', message: 'You don\'t have permission to remove members', originalType: 'removeGroupMember' }));
                  return;
                }

                // Check if the chat is a group
                dbConnection.query(
                  'SELECT Type, Owner FROM chat WHERE ChatID = ?',
                  [chatId],
                  (err, chatType) => {
                    if (err) {
                      console.error(err);
                      ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'removeGroupMember' }));
                      return;
                    }

                    if (chatType.length === 0 || chatType[0].Type !== 'group') {
                      ws.send(JSON.stringify({ type: 'error', message: 'This is not a group chat', originalType: 'removeGroupMember' }));
                      return;
                    }

                    // Prevent removing the owner
                    if (chatType[0].Owner === memberToRemoveId) {
                      ws.send(JSON.stringify({ type: 'error', message: 'Cannot remove the group owner', originalType: 'removeGroupMember' }));
                      return;
                    }

                    // Check if the member is in the group
                    dbConnection.query(
                      'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID = ?',
                      [chatId, memberToRemoveId],
                      (err, memberCheck) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'removeGroupMember' }));
                          return;
                        }

                        if (memberCheck.length === 0) {
                          ws.send(JSON.stringify({ type: 'error', message: 'User is not a member of this group', originalType: 'removeGroupMember' }));
                          return;
                        }

                        // Remove the member
                        dbConnection.query(
                          'DELETE FROM chatmember WHERE ChatID = ? AND UserID = ?',
                          [chatId, memberToRemoveId],
                          (err) => {
                            if (err) {
                              console.error(err);
                              ws.send(JSON.stringify({ type: 'error', message: 'Error removing member from group', originalType: 'removeGroupMember' }));
                              return;
                            }

                            // Notify the requester
                            ws.send(JSON.stringify({
                              type: 'ok',
                              originalType: 'removeGroupMember',
                              chatId: chatId,
                              memberToRemoveId: memberToRemoveId
                            }));

                            // Notify the group members
                            notifyGroupMembers(app, chatId, userId, 'memberRemoved', {
                              removedMemberId: memberToRemoveId,
                              removedBy: userId
                            });

                            // Notify the removed member if they're online
                            const message = {
                              type: 'removedFromGroup',
                              chatId: chatId,
                              removedBy: userId
                            };

                            const sentCount = sendToUserConnections(app, memberToRemoveId, message);
                            if (sentCount > 0) {
                              console.log(`Notified ${sentCount} connections of user ${memberToRemoveId} about being removed from group ${chatId}`);
                            }
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
            break;
          }
          case 'changeGroupRole': {
            const { chatId, memberToChangeId, newRole } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'changeGroupRole' }));
              return;
            }

            if (!chatId || !memberToChangeId || !newRole) {
              ws.send(JSON.stringify({ type: 'error', message: 'Chat ID, member ID, and new role are required', originalType: 'changeGroupRole' }));
              return;
            }

            // Validate the role
            if (newRole !== 'admin' && newRole !== 'member') {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid role. Must be "admin" or "member"', originalType: 'changeGroupRole' }));
              return;
            }

            // Check if the user is an admin of the group
            dbConnection.query(
              'SELECT Role FROM chatmember WHERE ChatID = ? AND UserID = ?',
              [chatId, userId],
              (err, adminCheck) => {
                if (err) {
                  console.error(err);
                  ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'changeGroupRole' }));
                  return;
                }

                if (adminCheck.length === 0 || adminCheck[0].Role !== 'admin') {
                  ws.send(JSON.stringify({ type: 'error', message: 'You don\'t have permission to change roles', originalType: 'changeGroupRole' }));
                  return;
                }

                // Check if the chat is a group
                dbConnection.query(
                  'SELECT Type FROM chat WHERE ChatID = ?',
                  [chatId],
                  (err, chatType) => {
                    if (err) {
                      console.error(err);
                      ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'changeGroupRole' }));
                      return;
                    }

                    if (chatType.length === 0 || chatType[0].Type !== 'group') {
                      ws.send(JSON.stringify({ type: 'error', message: 'This is not a group chat', originalType: 'changeGroupRole' }));
                      return;
                    }

                    // Check if the member is in the group
                    dbConnection.query(
                      'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID = ?',
                      [chatId, memberToChangeId],
                      (err, memberCheck) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'changeGroupRole' }));
                          return;
                        }

                        if (memberCheck.length === 0) {
                          ws.send(JSON.stringify({ type: 'error', message: 'User is not a member of this group', originalType: 'changeGroupRole' }));
                          return;
                        }

                        // Change the role
                        dbConnection.query(
                          'UPDATE chatmember SET Role = ? WHERE ChatID = ? AND UserID = ?',
                          [newRole, chatId, memberToChangeId],
                          (err) => {
                            if (err) {
                              console.error(err);
                              ws.send(JSON.stringify({ type: 'error', message: 'Error changing role', originalType: 'changeGroupRole' }));
                              return;
                            }

                            // Notify the requester
                            ws.send(JSON.stringify({
                              type: 'ok',
                              originalType: 'changeGroupRole',
                              chatId: chatId,
                              memberToChangeId: memberToChangeId,
                              newRole: newRole
                            }));

                            // Notify the group members
                            notifyGroupMembers(app, chatId, userId, 'roleChanged', {
                              memberId: memberToChangeId,
                              newRole: newRole,
                              changedBy: userId
                            });

                            // Notify the member whose role was changed if they're online
                            const message = {
                              type: 'roleChanged',
                              chatId: chatId,
                              newRole: newRole,
                              changedBy: userId
                            };

                            const sentCount = sendToUserConnections(app, memberToChangeId, message);
                            if (sentCount > 0) {
                              console.log(`Notified ${sentCount} connections of user ${memberToChangeId} about role change in group ${chatId}`);
                            }
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
            break;
          }
          case 'disbandGroup': {
            const { chatId } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'disbandGroup' }));
              return;
            }

            if (!chatId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Chat ID is required', originalType: 'disbandGroup' }));
              return;
            }

            // Check if the user is the owner of the group
            dbConnection.query(
              'SELECT Owner FROM chat WHERE ChatID = ? AND Type = ?',
              [chatId, "group"],
              (err, ownerCheck) => {
                if (err) {
                  console.error(err);
                  ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'disbandGroup' }));
                  return;
                }

                if (ownerCheck.length === 0) {
                  ws.send(JSON.stringify({ type: 'error', message: 'Group not found', originalType: 'disbandGroup' }));
                  return;
                }

                if (ownerCheck[0].Owner !== userId) {
                  ws.send(JSON.stringify({ type: 'error', message: 'Only the group owner can disband the group', originalType: 'disbandGroup' }));
                  return;
                }

                // Get all members before disbanding
                dbConnection.query(
                  'SELECT UserID FROM chatmember WHERE ChatID = ?',
                  [chatId],
                  (err, members) => {
                    if (err) {
                      console.error(err);
                      ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'disbandGroup' }));
                      return;
                    }

                    // Update the chat status to 'disbanded'
                    dbConnection.query(
                      'UPDATE chat SET Status = ? WHERE ChatID = ?',
                      ["disbanded", chatId],
                      (err) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Error disbanding group', originalType: 'disbandGroup' }));
                          return;
                        }

                        // Notify the requester
                        ws.send(JSON.stringify({
                          type: 'ok',
                          originalType: 'disbandGroup',
                          chatId: chatId
                        }));

                        // Notify all members
                        members.forEach(member => {
                          if (member.UserID !== userId) { // Don't notify the owner again
                            const message = {
                              type: 'groupDisbanded',
                              chatId: chatId,
                              disbandedBy: userId
                            };

                            const sentCount = sendToUserConnections(app, member.UserID, message);
                            if (sentCount > 0) {
                              console.log(`Notified ${sentCount} connections of user ${member.UserID} about group ${chatId} being disbanded`);
                            }
                          }
                        });
                      }
                    );
                  }
                );
              }
            );
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

                                        const messagePacket = {
                                          type: 'receiveChat',
                                          chatId: chatId,
                                          message: {
                                            ...messagePayload,
                                            messageId,
                                            type,
                                            content,
                                            senderId: userId,
                                            timestamp: timestamp
                                          }
                                        };

                                        const sentCount = sendToUserConnections(app, memberId, messagePacket);
                                        if (sentCount > 0) {
                                          console.log(`Message sent to ${sentCount} connections of user ${memberId}`);
                                        } else {
                                          console.log(`No active connections found for user ${memberId}`);
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

                                        const messagePacket = {
                                          type: 'receiveChat',
                                          chatId: chatId,
                                          message: {
                                            ...messagePayload,
                                            messageId,
                                            type,
                                            content,
                                            attachmentUrl,
                                            senderId: userId,
                                            timestamp: timestamp
                                          }
                                        };

                                        const sentCount = sendToUserConnections(app, memberId, messagePacket);
                                        if (sentCount > 0) {
                                          console.log(`Attachment message sent to ${sentCount} connections of user ${memberId}`);
                                        } else {
                                          console.log(`No active connections found for user ${memberId}`);
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
          case 'renameGroup': {
            const { chatId, newName } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'renameGroup' }));
              return;
            }

            if (!chatId || !newName) {
              ws.send(JSON.stringify({ type: 'error', message: 'Chat ID and new name are required', originalType: 'renameGroup' }));
              return;
            }

            // Check if the user is an admin of the group
            dbConnection.query(
              'SELECT Role FROM chatmember WHERE ChatID = ? AND UserID = ?',
              [chatId, userId],
              (err, adminCheck) => {
                if (err) {
                  console.error(err);
                  ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'renameGroup' }));
                  return;
                }

                if (adminCheck.length === 0 || !(["admin", "owner"].includes(adminCheck[0].Role))) {
                  ws.send(JSON.stringify({ type: 'error', message: 'You don\'t have permission to rename this group', originalType: 'renameGroup' }));
                  return;
                }

                // Check if the chat is a group
                dbConnection.query(
                  'SELECT Type FROM chat WHERE ChatID = ?',
                  [chatId],
                  (err, chatType) => {
                    if (err) {
                      console.error(err);
                      ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'renameGroup' }));
                      return;
                    }

                    if (chatType.length === 0 || chatType[0].Type !== 'group') {
                      ws.send(JSON.stringify({ type: 'error', message: 'This is not a group chat', originalType: 'renameGroup' }));
                      return;
                    }

                    // Rename the group
                    dbConnection.query(
                      'UPDATE chat SET ChatName = ? WHERE ChatID = ?',
                      [newName, chatId],
                      (err) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Error renaming group', originalType: 'renameGroup' }));
                          return;
                        }

                        // Notify the requester
                        ws.send(JSON.stringify({
                          type: 'ok',
                          originalType: 'renameGroup',
                          chatId: chatId,
                          newName: newName
                        }));

                        // Notify all group members
                        notifyGroupMembers(app, chatId, userId, 'groupRenamed', {
                          newName: newName,
                          renamedBy: userId
                        });
                      }
                    );
                  }
                );
              }
            );
            break;
          }
          case 'replyToMessage': {
            const { chatId, originalMessageId, content, type, attachmentUrl } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'replyToMessage' }));
              return;
            }

            if (!chatId || !originalMessageId || !content) {
              ws.send(JSON.stringify({ type: 'error', message: 'Chat ID, original message ID, and content are required', originalType: 'replyToMessage' }));
              return;
            }

            // Verify user is a member of the chat
            dbConnection.query(
                'SELECT COUNT(*) as isMember FROM chatmember WHERE ChatID = ? AND UserID = ?',
                [chatId, userId],
                (err, memberCheck) => {
                  if (err) {
                    console.error(err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'replyToMessage' }));
                    return;
                  }

                  if (memberCheck[0].isMember === 0) {
                    ws.send(JSON.stringify({ type: 'error', message: 'You are not a member of this chat', originalType: 'replyToMessage' }));
                    return;
                  }

                  // Verify original message exists
                  dbConnection.query(
                      `SELECT m.MessageID, m.UserID, m.Type, m.Timestamp,
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
         WHERE m.MessageID = ? AND m.ChatID = ?`,
                      [originalMessageId, chatId],
                      (err, originalMessages) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'replyToMessage' }));
                          return;
                        }

                        if (originalMessages.length === 0) {
                          ws.send(JSON.stringify({ type: 'error', message: 'Original message not found', originalType: 'replyToMessage' }));
                          return;
                        }

                        const originalMessage = originalMessages[0];
                        const timestamp = new Date();
                        const messageType = type || 'text';

                        // Create the new message
                        dbConnection.query(
                            'INSERT INTO message (ChatID, UserID, Type, Timestamp, ReplyToID) VALUES (?, ?, ?, ?, ?)',
                            [chatId, userId, messageType, timestamp, originalMessageId],
                            (err, messageResult) => {
                              if (err) {
                                console.error(err);
                                ws.send(JSON.stringify({ type: 'error', message: 'Error creating message', originalType: 'replyToMessage' }));
                                return;
                              }

                              const messageId = messageResult.insertId;

                              // Insert content based on message type
                              if (messageType === 'text') {
                                dbConnection.query(
                                    'INSERT INTO textmessage (MessageID, Content) VALUES (?, ?)',
                                    [messageId, content],
                                    (err) => {
                                      if (err) {
                                        console.error(err);
                                        ws.send(JSON.stringify({ type: 'error', message: 'Error storing message content', originalType: 'replyToMessage' }));
                                        return;
                                      }

                                      // Notify the sender
                                      ws.send(JSON.stringify({
                                        type: 'ok',
                                        originalType: 'replyToMessage',
                                        messageId: messageId,
                                        originalMessage: {
                                          messageId: originalMessage.MessageID,
                                          userId: originalMessage.UserID,
                                          type: originalMessage.Type,
                                          content: originalMessage.Content,
                                          attachmentUrl: originalMessage.AttachmentUrl,
                                          senderName: originalMessage.SenderName,
                                          timestamp: originalMessage.Timestamp
                                        }
                                      }));

                                      // Notify other chat members
                                      dbConnection.query(
                                          'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
                                          [chatId, userId],
                                          (err, memberResults) => {
                                            if (err) {
                                              console.error(err);
                                              return;
                                            }

                                            memberResults.forEach(member => {
                                              const memberId = member.UserID;

                                              const messagePacket = {
                                                type: 'receiveReply',
                                                chatId: chatId,
                                                message: {
                                                  messageId,
                                                  type: messageType,
                                                  content,
                                                  senderId: userId,
                                                  timestamp: timestamp,
                                                  replyTo: {
                                                    messageId: originalMessage.MessageID,
                                                    userId: originalMessage.UserID,
                                                    type: originalMessage.Type,
                                                    content: originalMessage.Content,
                                                    attachmentUrl: originalMessage.AttachmentUrl,
                                                    senderName: originalMessage.SenderName,
                                                    timestamp: originalMessage.Timestamp
                                                  }
                                                }
                                              };

                                              sendToUserConnections(app, memberId, messagePacket);
                                            });
                                          }
                                      );
                                    }
                                );
                              } else if (messageType === 'attachment') {
                                dbConnection.query(
                                    'INSERT INTO attachmentmessage (MessageID, Content, AttachmentUrl) VALUES (?, ?, ?)',
                                    [messageId, content, attachmentUrl],
                                    (err) => {
                                      if (err) {
                                        console.error(err);
                                        ws.send(JSON.stringify({ type: 'error', message: 'Error storing message content', originalType: 'replyToMessage' }));
                                        return;
                                      }

                                      // Notify the sender
                                      ws.send(JSON.stringify({
                                        type: 'ok',
                                        originalType: 'replyToMessage',
                                        messageId: messageId,
                                        originalMessage: {
                                          messageId: originalMessage.MessageID,
                                          userId: originalMessage.UserID,
                                          type: originalMessage.Type,
                                          content: originalMessage.Content,
                                          attachmentUrl: originalMessage.AttachmentUrl,
                                          senderName: originalMessage.SenderName,
                                          timestamp: originalMessage.Timestamp
                                        }
                                      }));

                                      // Notify other chat members
                                      dbConnection.query(
                                          'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
                                          [chatId, userId],
                                          (err, memberResults) => {
                                            if (err) {
                                              console.error(err);
                                              return;
                                            }

                                            memberResults.forEach(member => {
                                              const memberId = member.UserID;

                                              const messagePacket = {
                                                type: 'receiveReply',
                                                chatId: chatId,
                                                message: {
                                                  messageId,
                                                  type: messageType,
                                                  content,
                                                  attachmentUrl,
                                                  senderId: userId,
                                                  timestamp: timestamp,
                                                  replyTo: {
                                                    messageId: originalMessage.MessageID,
                                                    userId: originalMessage.UserID,
                                                    type: originalMessage.Type,
                                                    content: originalMessage.Content,
                                                    attachmentUrl: originalMessage.AttachmentUrl,
                                                    senderName: originalMessage.SenderName,
                                                    timestamp: originalMessage.Timestamp
                                                  }
                                                }
                                              };

                                              sendToUserConnections(app, memberId, messagePacket);
                                            });
                                          }
                                      );
                                    }
                                );
                              } else {
                                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message type', originalType: 'replyToMessage' }));
                              }
                            }
                        );
                      }
                  );
                }
            );
            break;
          }
          case 'forwardMessage': {
            const { originalMessageId, targetChatId } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'forwardMessage' }));
              return;
            }

            if (!originalMessageId || !targetChatId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Original message ID and target chat ID are required', originalType: 'forwardMessage' }));
              return;
            }

            // Verify user is a member of the target chat
            dbConnection.query(
                'SELECT COUNT(*) as isMember FROM chatmember WHERE ChatID = ? AND UserID = ?',
                [targetChatId, userId],
                (err, memberCheck) => {
                  if (err) {
                    console.error(err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'forwardMessage' }));
                    return;
                  }

                  if (memberCheck[0].isMember === 0) {
                    ws.send(JSON.stringify({ type: 'error', message: 'You are not a member of the target chat', originalType: 'forwardMessage' }));
                    return;
                  }

                  // Get the original message details
                  dbConnection.query(
                      `SELECT m.MessageID, m.UserID, m.Type, m.ChatID,
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
         WHERE m.MessageID = ?`,
                      [originalMessageId],
                      (err, originalMessages) => {
                        if (err) {
                          console.error(err);
                          ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'forwardMessage' }));
                          return;
                        }

                        if (originalMessages.length === 0) {
                          ws.send(JSON.stringify({ type: 'error', message: 'Original message not found', originalType: 'forwardMessage' }));
                          return;
                        }

                        const originalMessage = originalMessages[0];

                        // Verify user has access to the original message
                        dbConnection.query(
                            'SELECT COUNT(*) as isMember FROM chatmember WHERE ChatID = ? AND UserID = ?',
                            [originalMessage.ChatID, userId],
                            (err, sourceMemberCheck) => {
                              if (err) {
                                console.error(err);
                                ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'forwardMessage' }));
                                return;
                              }

                              if (sourceMemberCheck[0].isMember === 0) {
                                ws.send(JSON.stringify({ type: 'error', message: 'You don\'t have access to the original message', originalType: 'forwardMessage' }));
                                return;
                              }

                              const timestamp = new Date();

                              // Create the new message as a forwarded message
                              dbConnection.query(
                                  'INSERT INTO message (ChatID, UserID, Type, Timestamp, ForwardedFrom) VALUES (?, ?, ?, ?, ?)',
                                  [targetChatId, userId, originalMessage.Type, timestamp, originalMessageId],
                                  (err, messageResult) => {
                                    if (err) {
                                      console.error(err);
                                      ws.send(JSON.stringify({ type: 'error', message: 'Error creating message', originalType: 'forwardMessage' }));
                                      return;
                                    }

                                    const messageId = messageResult.insertId;

                                    // Insert content based on message type
                                    if (originalMessage.Type === 'text') {
                                      dbConnection.query(
                                          'INSERT INTO textmessage (MessageID, Content) VALUES (?, ?)',
                                          [messageId, originalMessage.Content],
                                          (err) => {
                                            if (err) {
                                              console.error(err);
                                              ws.send(JSON.stringify({ type: 'error', message: 'Error storing message content', originalType: 'forwardMessage' }));
                                              return;
                                            }

                                            // Notify the sender
                                            ws.send(JSON.stringify({
                                              type: 'ok',
                                              originalType: 'forwardMessage',
                                              messageId: messageId
                                            }));

                                            // Get original sender info
                                            dbConnection.query(
                                                'SELECT Name FROM user WHERE UserID = ?',
                                                [originalMessage.UserID],
                                                (err, userResults) => {
                                                  const originalSenderName = err || userResults.length === 0 ? 'Unknown User' : userResults[0].Name;

                                                  // Notify target chat members
                                                  dbConnection.query(
                                                      'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
                                                      [targetChatId, userId],
                                                      (err, memberResults) => {
                                                        if (err) {
                                                          console.error(err);
                                                          return;
                                                        }

                                                        memberResults.forEach(member => {
                                                          const memberId = member.UserID;

                                                          const messagePacket = {
                                                            type: 'receiveForward',
                                                            chatId: targetChatId,
                                                            message: {
                                                              messageId,
                                                              type: originalMessage.Type,
                                                              content: originalMessage.Content,
                                                              senderId: userId,
                                                              timestamp: timestamp,
                                                              forwardedFrom: {
                                                                messageId: originalMessageId,
                                                                userId: originalMessage.UserID,
                                                                senderName: originalSenderName
                                                              }
                                                            }
                                                          };

                                                          sendToUserConnections(app, memberId, messagePacket);
                                                        });
                                                      }
                                                  );
                                                }
                                            );
                                          }
                                      );
                                    } else if (originalMessage.Type === 'attachment') {
                                      dbConnection.query(
                                          'INSERT INTO attachmentmessage (MessageID, Content, AttachmentUrl) VALUES (?, ?, ?)',
                                          [messageId, originalMessage.Content, originalMessage.AttachmentUrl],
                                          (err) => {
                                            if (err) {
                                              console.error(err);
                                              ws.send(JSON.stringify({ type: 'error', message: 'Error storing message content', originalType: 'forwardMessage' }));
                                              return;
                                            }

                                            // Notify the sender
                                            ws.send(JSON.stringify({
                                              type: 'ok',
                                              originalType: 'forwardMessage',
                                              messageId: messageId
                                            }));

                                            // Get original sender info
                                            dbConnection.query(
                                                'SELECT Name FROM user WHERE UserID = ?',
                                                [originalMessage.UserID],
                                                (err, userResults) => {
                                                  const originalSenderName = err || userResults.length === 0 ? 'Unknown User' : userResults[0].Name;

                                                  // Notify target chat members
                                                  dbConnection.query(
                                                      'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
                                                      [targetChatId, userId],
                                                      (err, memberResults) => {
                                                        if (err) {
                                                          console.error(err);
                                                          return;
                                                        }

                                                        memberResults.forEach(member => {
                                                          const memberId = member.UserID;

                                                          const messagePacket = {
                                                            type: 'receiveForward',
                                                            chatId: targetChatId,
                                                            message: {
                                                              messageId,
                                                              type: originalMessage.Type,
                                                              content: originalMessage.Content,
                                                              attachmentUrl: originalMessage.AttachmentUrl,
                                                              senderId: userId,
                                                              timestamp: timestamp,
                                                              forwardedFrom: {
                                                                messageId: originalMessageId,
                                                                userId: originalMessage.UserID,
                                                                senderName: originalSenderName
                                                              }
                                                            }
                                                          };

                                                          sendToUserConnections(app, memberId, messagePacket);
                                                        });
                                                      }
                                                  );
                                                }
                                            );
                                          }
                                      );
                                    }
                                  }
                              );
                            }
                        );
                      }
                  );
                }
            );
            break;
          }
          case 'deleteMessage': {
            const { messageId, deleteType } = packet;
            const userId = ws.userID;

            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated', originalType: 'deleteMessage' }));
              return;
            }

            if (!messageId || !deleteType) {
              ws.send(JSON.stringify({ type: 'error', message: 'Message ID and delete type are required', originalType: 'deleteMessage' }));
              return;
            }

            if (!['remove', 'unsent', 'delete_for_me'].includes(deleteType)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid delete type', originalType: 'deleteMessage' }));
              return;
            }

            // Get message details
            dbConnection.query(
                'SELECT m.Type, m.UserID, m.ChatID FROM message m WHERE m.MessageID = ?',
                [messageId],
                (err, messages) => {
                  if (err) {
                    console.error(err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'deleteMessage' }));
                    return;
                  }

                  if (messages.length === 0) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Message not found', originalType: 'deleteMessage' }));
                    return;
                  }

                  const message = messages[0];

                  // For 'unsent', verify the user is the sender
                  if (deleteType === 'unsent' && message.UserID !== userId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'You can only unsend your own messages', originalType: 'deleteMessage' }));
                    return;
                  }

                  // For personal deletion, create a record in message_deletions table
                  if (deleteType === 'delete_for_me') {
                    // Check if user is a member of the chat
                    dbConnection.query(
                        'SELECT COUNT(*) as isMember FROM chatmember WHERE ChatID = ? AND UserID = ?',
                        [message.ChatID, userId],
                        (err, memberCheck) => {
                          if (err) {
                            console.error(err);
                            ws.send(JSON.stringify({ type: 'error', message: 'Database error', originalType: 'deleteMessage' }));
                            return;
                          }

                          if (memberCheck[0].isMember === 0) {
                            ws.send(JSON.stringify({ type: 'error', message: 'You are not a member of this chat', originalType: 'deleteMessage' }));
                            return;
                          }

                          // Insert into message_deletions table
                          const now = new Date();
                          dbConnection.query(
                              'INSERT INTO message_deletions (MessageID, UserID, DeletedTimestamp) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE DeletedTimestamp = ?',
                              [messageId, userId, now, now],
                              (err) => {
                                if (err) {
                                  console.error(err);
                                  ws.send(JSON.stringify({ type: 'error', message: 'Error deleting message', originalType: 'deleteMessage' }));
                                  return;
                                }

                                ws.send(JSON.stringify({
                                  type: 'ok',
                                  originalType: 'deleteMessage',
                                  messageId: messageId,
                                  deleteType: deleteType
                                }));
                              }
                          );
                        }
                    );
                  } else {
                    // For 'remove' or 'unsent', update the message type
                    let updateQuery;

                    if (message.Type === 'text') {
                      updateQuery = 'UPDATE textmessage SET Type = ? WHERE MessageID = ?';
                    } else if (message.Type === 'attachment') {
                      updateQuery = 'UPDATE attachmentmessage SET Type = ? WHERE MessageID = ?';
                    } else {
                      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type', originalType: 'deleteMessage' }));
                      return;
                    }

                    dbConnection.query(
                        updateQuery,
                        [deleteType, messageId],
                        (err, result) => {
                          if (err) {
                            console.error(err);
                            ws.send(JSON.stringify({ type: 'error', message: 'Error updating message', originalType: 'deleteMessage' }));
                            return;
                          }

                          if (result.affectedRows === 0) {
                            ws.send(JSON.stringify({ type: 'error', message: 'Failed to update message', originalType: 'deleteMessage' }));
                            return;
                          }

                          // Notify the requester
                          ws.send(JSON.stringify({
                            type: 'ok',
                            originalType: 'deleteMessage',
                            messageId: messageId,
                            deleteType: deleteType
                          }));

                          // Notify other chat members
                          dbConnection.query(
                              'SELECT UserID FROM chatmember WHERE ChatID = ? AND UserID != ?',
                              [message.ChatID, userId],
                              (err, memberResults) => {
                                if (err) {
                                  console.error(err);
                                  return;
                                }

                                memberResults.forEach(member => {
                                  const memberId = member.UserID;

                                  const messagePacket = {
                                    type: 'messageDeleted',
                                    chatId: message.ChatID,
                                    messageId: messageId,
                                    deleteType: deleteType,
                                    deletedBy: userId
                                  };

                                  sendToUserConnections(app, memberId, messagePacket);
                                });
                              }
                          );
                        }
                    );
                  }
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
      if (ws.userID) {
        const connections = userConnections.get(ws.userID);
        if (connections) {
          connections.delete(ws);

          console.log(`One connection for User ${ws.userID} disconnected`);

          // If no connections left, remove the user from the map
          if (connections.size === 0) {
            userConnections.delete(ws.userID);
            console.log(`User ${ws.userID} has no more active connections`);
          } else {
            console.log(`User ${ws.userID} still has ${connections.size} active connections`);
          }
        }
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

  // Periodic cleanup of stale connections
  setInterval(() => {
    console.log('Checking for stale connections...');
    let totalConnections = 0;
    let removedConnections = 0;

    userConnections.forEach((connections, userId) => {
      const initialSize = connections.size;
      totalConnections += initialSize;

      const deadConnections = [];
      connections.forEach(conn => {
        if (conn.readyState !== 1) { // Not OPEN
          deadConnections.push(conn);
        }
      });

      // Clean up dead connections
      deadConnections.forEach(conn => {
        connections.delete(conn);
      });

      removedConnections += deadConnections.length;

      // If no connections left, remove the user from the map
      if (connections.size === 0) {
        userConnections.delete(userId);
        console.log(`Removed user ${userId} from connections map (no active connections)`);
      } else if (deadConnections.length > 0) {
        console.log(`Removed ${deadConnections.length} stale connections for user ${userId}, ${connections.size} remaining`);
      }
    });

    console.log(`Active users: ${userConnections.size}, Total connections: ${totalConnections}, Removed: ${removedConnections}`);
  }, 60000);

  console.log('WebSocket server initialized at /ws');
};
