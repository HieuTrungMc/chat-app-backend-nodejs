const express = require('express')
const multer = require('multer')
const cors = require('cors')
const chatRoute = require('./routes/index')
const app = express()
app.use(cors())

//const upload = multer()

app.use(express.json({ extended: false }))

app.use("/user", chatRoute)

app.listen(process.env.PORT, () => {
    console.log(`Server running at ${process.env.PORT}`);
})