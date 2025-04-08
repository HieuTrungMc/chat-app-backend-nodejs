const express = require("express")
const router = express.Router()
const chatController = require('../controllers/chatController')
const userController = require('../controllers/userController')
const upload = require("../middleware/upload")

//login path
router.get('/', chatController.getMainPath)
router.post('/signup', userController.registerAccount)
router.get('/account', userController.getAccountByParam)
router.post('/login', userController.loginAccount)
router.post('/update', userController.updateAccount)
router.post('/upload', upload, userController.uploadImage)
router.post('/changepass', userController.changePassword)
module.exports = router