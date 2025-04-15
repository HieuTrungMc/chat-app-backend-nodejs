const express = require("express");
const router = express.Router();
const contactController = require('../controllers/contactController');

// Contact routes
router.get('/list', contactController.listContacts);
router.get('/find', contactController.findByPhone);
router.post('/add', contactController.addContact);
router.get('/requests', contactController.listRequests);
router.post('/accept', contactController.acceptRequest);
router.get('/sent', contactController.listSentRequests);
module.exports = router;