const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const https = require('https');
const expressWs = require('express-ws');

const userRoute = require('./routes/userRoutes');
const chatRoute = require('./routes/chatRoutes');
const contactRoute = require('./routes/contactRoutes');
const groupChatRoute = require('./routes/groupChatRoutes');
const callRoute = require('./routes/callRoutes')
const setupSignalingServer = require('./service/signaling')
const privateKey = fs.readFileSync('./cert/privkey.pem', 'utf8');
const certificate = fs.readFileSync('./cert/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };


const app = express();

app.use(cors());
app.use(express.json({ extended: false }));

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.use("/user", userRoute);
app.use("/chat", chatRoute);
app.use("/contact", contactRoute);
app.use("/group", groupChatRoute);
app.use("/call", callRoute)

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

expressWs(app, httpServer);
expressWs(app, httpsServer);

setupSignalingServer(httpServer)
setupSignalingServer(httpsServer)

require('./routes/websocketserver')(app);

const HTTP_PORT = process.env.PORT || 80;
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP Server running on port ${HTTP_PORT} :3`);
});

const HTTPS_PORT = process.env.HTTPS_PORT || 443;
httpsServer.listen(HTTPS_PORT, () => {
  console.log(`HTTPS Server running on port ${HTTPS_PORT} :3`);
});
