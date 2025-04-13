const express = require('express')
const multer = require('multer')
const cors = require('cors')
const expressWs = require('express-ws')
const userRoute = require('./routes/index')
const chatRoute = require('./routes/chatRoutes')

const app = express()
expressWs(app)

app.use(cors())
app.use(express.json({ extended: false }))

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
  )
  next()
})

// Routes
app.use("/user", userRoute)
app.use("/chat", chatRoute)

// WebSocket route - import and use it directly here
require('./routes/websocketserver')(app)

app.listen(process.env.PORT, () => {
  console.log(`Server running at ${process.env.PORT}`);
})