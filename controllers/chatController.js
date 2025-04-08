const ChatModel = require('../models/chatModel');
const { uploadFile } = require('../service');
const Controller = {};

Controller.getMainPath = async (req, res) => {
    res.status(200).send("Api is working")
}
module.exports = Controller
