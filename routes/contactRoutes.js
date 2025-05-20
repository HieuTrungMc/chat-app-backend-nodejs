const express = require("express");
const router = express.Router();
const contactController = require('../controllers/contactController');

// Contact routes
router.get('/list', contactController.listContacts);
router.get('/find', contactController.findByPhone);
router.post('/add', contactController.addContact);
router.get('/requests', contactController.listRequests);
router.post('/accept', contactController.acceptRequest);
router.post('/deny', contactController.denyRequest);
router.get('/sent', contactController.listSentRequests);
router.get('/findByName', contactController.findByName);
router.post('/unfriend', contactController.unfriendContact);
router.post('/block', contactController.blockContact);
router.post('/unblock', contactController.unblockContact);
module.exports = router;