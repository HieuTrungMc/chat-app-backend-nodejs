const multer = require("multer");

const storage = multer.memoryStorage({
    destination: function(req, file, cb) {
        cb(null, "/")
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 10
    }
}).single("file")

module.exports = upload