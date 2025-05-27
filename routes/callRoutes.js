const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

// Route to initialize a call
router.post('/initiate', callController.initiateCall);

// Route to get call history
router.get('/history/:userId', callController.getCallHistory);

module.exports = router;