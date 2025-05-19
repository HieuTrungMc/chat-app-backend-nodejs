const express = require("express");
const router = express.Router();
const groupChatController = require('../controllers/groupChatController');

// Group creation
router.post('/create', groupChatController.createGroup);

// Group member management
router.post('/member/add', groupChatController.addMember);
router.post('/member/remove', groupChatController.removeMember);
router.post('/member/role', groupChatController.changeRole);

// Group management
router.post('/disband', groupChatController.disbandGroup);
router.get('/:chatId/members', groupChatController.getGroupMembers);
router.post('/leave', groupChatController.leaveGroup);
router.post('/rename', groupChatController.renameGroup);
router.post('/:chatId/updateimage', groupChatController.updateGroupImage); // New route for updating group image

module.exports = router;