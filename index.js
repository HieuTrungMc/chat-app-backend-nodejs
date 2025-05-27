const express = require('express')
const multer = require('multer')
const cors = require('cors')
const expressWs = require('express-ws')
const http = require('http')
const userRoute = require('./routes/userRoutes')
const chatRoute = require('./routes/chatRoutes')
const contactRoute = require('./routes/contactRoutes')
const groupChatRoute = require('./routes/groupChatRoutes')
const callRoute = require('./routes/callRoutes')
const setupSignalingServer = require('./service/signaling')

const app = express()
const server = http.createServer(app)
expressWs(app, server)

// Set up Socket.io signaling server
const io = setupSignalingServer(server)

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
app.use("/contact", contactRoute)
app.use("/group", groupChatRoute)
app.use("/call", callRoute)

// WebSocket route - import and use it directly here
require('./routes/websocketserver')(app)

// Use server.listen instead of app.listen
server.listen(process.env.PORT, () => {
  console.log(`Server running at ${process.env.PORT}`)
})