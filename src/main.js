const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('./folderStructure');

// Import handlers
const socketHandler = require('./modules/socketHandler');
const httpHandler = require('./modules/httpHandler');

// A function to set up socket io and return http router
module.exports = (httpServer) => {
  const io = socketIo(httpServer);
  socketHandler(io);
  return httpHandler(io);
};

// A simple plug-and-play method to just start the service right away
module.exports.listen = (port = process.env.PORT || 8080, callback) => {
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = socketIo(httpServer);

  socketHandler(io);
  const router = httpHandler(io);
  app.use('/', router);

  httpServer.listen(port, callback);
};
