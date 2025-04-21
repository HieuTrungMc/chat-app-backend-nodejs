const { pool } = require("../utils/aws-helper");

const groupChatModel = {
  createGroup: async (name, image, ownerId, initialMembers = []) => {
    try {
      // Generate a unique chat ID
      const chatId = `group-${+ new Date()}`;
      const createdDate = new Date();
      
      // Create the group chat
      const createChatQuery = `
        INSERT INTO chat (ChatID, CreatedDate, Type, Status, Owner, ChatImage, ChatName)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await pool.execute(createChatQuery, [chatId, createdDate, 'group', 'active', ownerId, image, name]);
      
      // Add the owner as a member with 'admin' role
      const addOwnerQuery = `
        INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp)
        VALUES (?, ?, ?, ?)
      `;
      await pool.execute(addOwnerQuery, [chatId, ownerId, 'owner', createdDate]);
      
      // Add initial members if provided
      if (initialMembers.length > 0) {
        const addMembersQuery = `
          INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp)
          VALUES ?
        `;
        
        const memberValues = initialMembers.map(memberId => 
          [chatId, memberId, 'member', createdDate]
        );
        
        await pool.query(addMembersQuery, [memberValues]);
        
        // Create notifications for the invited members
        const notificationQuery = `
          INSERT INTO notification (Type, Sender, Receiver, CreatedAt, Details)
          VALUES ?
        `;
        
        const notificationValues = initialMembers.map(memberId => [
          'group_invite', 
          ownerId, 
          memberId, 
          createdDate, 
          JSON.stringify({ chatId, action: 'added_to_group', groupName: name })
        ]);
        
        await pool.query(notificationQuery, [notificationValues]);
      }
      
      return {
        success: true,
        chatId,
        message: "Group created successfully"
      };
    } catch (error) {
      console.error("Error in createGroup:", error);
      throw error;
    }
  },
  
  addMember: async (chatId, userId, newMemberId, role = 'member') => {
    try {
      // Check if the user is an admin of the group
      const adminCheckQuery = `
        SELECT Role
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [adminCheck] = await pool.execute(adminCheckQuery, [chatId, userId]);
      
      if (adminCheck.length === 0 || !(["admin", "owner"].includes(adminCheck[0].Role))) {
        return {
          success: false,
          message: "You don't have permission to add members to this group"
        };
      }
      
      // Check if the chat is a group
      const chatTypeQuery = `
        SELECT Type
        FROM chat
        WHERE ChatID = ?
      `;
      const [chatType] = await pool.execute(chatTypeQuery, [chatId]);
      
      if (chatType.length === 0 || chatType[0].Type !== 'group') {
        return {
          success: false,
          message: "This is not a group chat"
        };
      }
      
      // Check if the member is already in the group
      const memberCheckQuery = `
        SELECT UserID
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [memberCheck] = await pool.execute(memberCheckQuery, [chatId, newMemberId]);
      
      if (memberCheck.length > 0) {
        return {
          success: false,
          message: "User is already a member of this group"
        };
      }
      
      // Add the new member
      const addMemberQuery = `
        INSERT INTO chatmember (ChatID, UserID, Role, AddedTimestamp)
        VALUES (?, ?, ?, ?)
      `;
      await pool.execute(addMemberQuery, [chatId, newMemberId, role, new Date()]);
      
      // Get group name for notification
      const groupNameQuery = `
        SELECT c.ChatID
        FROM chat c
        WHERE c.ChatID = ?
      `;
      const [groupResult] = await pool.execute(groupNameQuery, [chatId]);
      
      if (groupResult.length > 0) {
        // Create a notification for the new member
        const notificationQuery = `
          INSERT INTO notification (Type, Sender, Receiver, CreatedAt, Details)
          VALUES (?, ?, ?, ?, ?)
        `;
        
        const notificationDetails = JSON.stringify({
          chatId,
          action: 'added_to_group',
          groupName: `Group ${chatId}`
        });
        
        await pool.execute(notificationQuery, [
          'group_invite', 
          userId, 
          newMemberId, 
          new Date(), 
          notificationDetails
        ]);
      }
      
      return {
        success: true,
        message: "Member added successfully"
      };
    } catch (error) {
      console.error("Error in addMember:", error);
      throw error;
    }
  },
  
  removeMember: async (chatId, userId, memberToRemoveId) => {
    try {
      // Check if the user is an admin of the group
      const adminCheckQuery = `
        SELECT Role
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [adminCheck] = await pool.execute(adminCheckQuery, [chatId, userId]);
      
      if (adminCheck.length === 0 || !(["admin", "owner"].includes(adminCheck[0].Role))) {
        // Allow users to remove themselves
        if (userId !== memberToRemoveId) {
          return {
            success: false,
            message: "You don't have permission to remove members from this group"
          };
        }
      }
      
      // Check if the chat is a group
      const chatTypeQuery = `
        SELECT Type, Owner
        FROM chat
        WHERE ChatID = ?
      `;
      const [chatType] = await pool.execute(chatTypeQuery, [chatId]);
      
      if (chatType.length === 0 || chatType[0].Type !== 'group') {
        return {
          success: false,
          message: "This is not a group chat"
        };
      }
      
      // Prevent removing the owner
      if (chatType[0].Owner === memberToRemoveId) {
        return {
          success: false,
          message: "Cannot remove the group owner"
        };
      }
      
      // Check if the member is in the group
      const memberCheckQuery = `
        SELECT UserID
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [memberCheck] = await pool.execute(memberCheckQuery, [chatId, memberToRemoveId]);
      
      if (memberCheck.length === 0) {
        return {
          success: false,
          message: "User is not a member of this group"
        };
      }
      
      // Remove the member
      const removeMemberQuery = `
        DELETE FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      await pool.execute(removeMemberQuery, [chatId, memberToRemoveId]);
      
      return {
        success: true,
        message: "Member removed successfully"
      };
    } catch (error) {
      console.error("Error in removeMember:", error);
      throw error;
    }
  },
  
  changeRole: async (chatId, userId, memberToChangeId, newRole) => {
    try {
      // Check if the user is an admin of the group
      const adminCheckQuery = `
        SELECT Role
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [adminCheck] = await pool.execute(adminCheckQuery, [chatId, userId]);
      
      if (adminCheck.length === 0 || !(["admin", "owner"].includes(adminCheck[0].Role))) {
        return {
          success: false,
          message: "You don't have permission to change roles in this group"
        };
      }
      
      // Check if the chat is a group
      const chatTypeQuery = `
        SELECT Type
        FROM chat
        WHERE ChatID = ?
      `;
      const [chatType] = await pool.execute(chatTypeQuery, [chatId]);
      
      if (chatType.length === 0 || chatType[0].Type !== 'group') {
        return {
          success: false,
          message: "This is not a group chat"
        };
      }
      
      // Check if the member is in the group
      const memberCheckQuery = `
        SELECT UserID
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [memberCheck] = await pool.execute(memberCheckQuery, [chatId, memberToChangeId]);
      
      if (memberCheck.length === 0) {
        return {
          success: false,
          message: "User is not a member of this group"
        };
      }
      
      // Validate the role
      if (newRole !== 'admin' && newRole !== 'member' && newRole !== 'owner') {
        return {
          success: false,
          message: "Invalid role. Must be 'admin' or 'member'"
        };
      }
      
      // Change the role
      const changeRoleQuery = `
        UPDATE chatmember
        SET Role = ?
        WHERE ChatID = ? AND UserID = ?
      `;
      await pool.execute(changeRoleQuery, [newRole, chatId, memberToChangeId]);
      
      return {
        success: true,
        message: "Role changed successfully"
      };
    } catch (error) {
      console.error("Error in changeRole:", error);
      throw error;
    }
  },
  
  disbandGroup: async (chatId, userId) => {
    try {
      // Check if the user is the owner of the group
      const ownerCheckQuery = `
        SELECT Owner
        FROM chat
        WHERE ChatID = ? AND Type = 'group'
      `;
      const [ownerCheck] = await pool.execute(ownerCheckQuery, [chatId]);
      
      if (ownerCheck.length === 0) {
        return {
          success: false,
          message: "Group not found"
        };
      }
      
      if (ownerCheck[0].Owner !== userId) {
        return {
          success: false,
          message: "Only the group owner can disband the group"
        };
      }
      
      // Update the chat status to 'disbanded'
      const updateChatQuery = `
        UPDATE chat
        SET Status = 'disbanded'
        WHERE ChatID = ?
      `;
      await pool.execute(updateChatQuery, [chatId]);
      
      return {
        success: true,
        message: "Group disbanded successfully"
      };
    } catch (error) {
      console.error("Error in disbandGroup:", error);
      throw error;
    }
  },
  
  getGroupMembers: async (chatId, userId) => {
    try {
      // Check if the user is a member of the group
      const memberCheckQuery = `
        SELECT COUNT(*) as isMember
        FROM chatmember
        WHERE ChatID = ? AND UserID = ?
      `;
      const [memberCheck] = await pool.execute(memberCheckQuery, [chatId, userId]);
      
      if (memberCheck[0].isMember === 0) {
        return {
          success: false,
          message: "You are not a member of this group"
        };
      }
      
      // Check if the chat is a group
      const chatTypeQuery = `
        SELECT Type
        FROM chat
        WHERE ChatID = ?
      `;
      const [chatType] = await pool.execute(chatTypeQuery, [chatId]);
      
      if (chatType.length === 0 || chatType[0].Type !== 'group') {
        return {
          success: false,
          message: "This is not a group chat"
        };
      }
      
      // Get all members
      const membersQuery = `
        SELECT cm.UserID, cm.Role, u.Name, u.ImageUrl
        FROM chatmember cm
        JOIN user u ON cm.UserID = u.UserID
        WHERE cm.ChatID = ?
      `;
      const [members] = await pool.execute(membersQuery, [chatId]);
      
      return {
        success: true,
        members: members.map(m => ({
          userId: m.UserID,
          role: m.Role,
          name: m.Name,
          imageUrl: m.ImageUrl
        }))
      };
    } catch (error) {
      console.error("Error in getGroupMembers:", error);
      throw error;
    }
  },

  leaveGroup: async (chatId, userId) => {
    try {
      // Check if the chat is a group
      const chatTypeQuery = `
      SELECT Type, Owner
      FROM chat
      WHERE ChatID = ?
    `;
      const [chatType] = await pool.execute(chatTypeQuery, [chatId]);

      if (chatType.length === 0 || chatType[0].Type !== 'group') {
        return {
          success: false,
          message: "This is not a group chat"
        };
      }

      // Check if the user is a member of the group
      const memberCheckQuery = `
      SELECT COUNT(*) as isMember
      FROM chatmember
      WHERE ChatID = ? AND UserID = ?
    `;
      const [memberCheck] = await pool.execute(memberCheckQuery, [chatId, userId]);

      if (memberCheck[0].isMember === 0) {
        return {
          success: false,
          message: "You are not a member of this group"
        };
      }

      // Check if the user is the owner of the group
      if (chatType[0].Owner === userId) {
        return {
          success: false,
          message: "You are the owner, you should transfer owner to someone or strike the delete button!."
        };
      }

      // Remove the user from the group
      const leaveGroupQuery = `
      DELETE FROM chatmember
      WHERE ChatID = ? AND UserID = ?
    `;
      await pool.execute(leaveGroupQuery, [chatId, userId]);

      return {
        success: true,
        message: "You have left the group successfully"
      };
    } catch (error) {
      console.error("Error in leaveGroup:", error);
      throw error;
    }
  }
};

module.exports = groupChatModel;