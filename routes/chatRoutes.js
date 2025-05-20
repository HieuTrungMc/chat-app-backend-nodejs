const express = require("express")
const router = express.Router()
const chatController = require('../controllers/chatController')
const upload = require("../middleware/upload")

// Basic chat routes
router.get('/', chatController.getMainPath)
router.get('/me', chatController.getUserChats)
router.get('/search', chatController.searchChatsByName)

// Chat specific routes
router.get('/:chatId/info', chatController.getChatInfo)
router.get('/:chatId/history/:count', chatController.getChatHistory)
router.get('/:chatId/search', chatController.searchMessages)

// Message actions
router.post('/deleteMsg', chatController.deleteMessage)
router.post('/replyToMsg', chatController.replyToMessage)
router.post('/forwardMsg', chatController.forwardMessage)

// Private chat
router.get('/private', chatController.getOrCreatePrivateChat);

module.exports = router;