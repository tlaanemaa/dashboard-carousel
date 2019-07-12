const dashboardState = require('../helpers/dashboardsState');
const { cleanName } = require('../helpers/utils');

module.exports = (io) => {
  io.on('connection', (socket) => {
    // Metadata about this socket
    const meta = {
      dashboardName: null,
    };

    // Helper to leave room
    const leaveCurrentRoom = () => {
      // Leave room if there is one
      if (meta.dashboardName) {
        socket.leave(meta.dashboardName);
        meta.dashboardName = null;
      }
    };

    // Room joining request
    socket.on('join', (data) => {
      const cleanedName = cleanName(data.name);
      if (cleanedName) {
        leaveCurrentRoom();
        socket.join(cleanedName);
        meta.dashboardName = cleanedName;

        // Send current state to the new client
        socket.emit('currentState', dashboardState.get(meta.dashboardName));
      }
    });
  });
};
