const path = require('path');
const express = require('express');
const pug = require('pug');
const constants = require('../helpers/constants');
const dashboardState = require('../helpers/dashboardsState');
const { cleanName, getAudioFiles, handleRouteError } = require('../helpers/utils');

// Per-process version id used to check if server is restarted from the front end
const versionId = Date.now().toString(32) + Math.round(Math.random() * 100000000).toString(32);

// Directory where views are kept
const viewsDir = path.resolve(__dirname, '..', 'views');

module.exports = (io) => {
  // Helpers to send data
  const send = (room, name, data = null) => io.to(room).emit(name, data);
  const sendAll = (name, data = null) => io.sockets.emit(name, data);

  // Helper to get number of clients in a room
  const clientsInRoom = (name) => {
    const room = io.sockets.adapter.rooms[name];
    return room ? room.length : 0;
  };

  // Create router
  const router = express.Router();

  // Static file routes
  router.use('/dashboard-files', express.static(path.resolve(__dirname, '..', 'public')));
  router.use('/dashboard-audio', express.static(constants.folders.audio));

  // Add endpoint that will return version hash. This allows reloading front ends on server reload.
  router.get('/dashboard-status', (req, res) => {
    res.send({ versionId });
  });

  /*
    Render dashboard page
    We don't use the view engine property on express here
    because we don't want to pollute its global settings
  */
  router.get('/dashboard/:name', handleRouteError((req, res) => {
    const cleanedName = cleanName(req.params.name);
    res.send(pug.renderFile(path.join(viewsDir, 'dashboard.pug'), {
      baseUrl: req.baseUrl,
      name: req.params.name,
      themeColors: dashboardState.get(cleanedName).themeColors,
      setup: Object.keys(req.query).includes('setup'),
      serviceVersion: process.env.npm_package_version,
    }));
  }));

  // Render dashboard management page
  router.get('/dashboard-management/:name', handleRouteError(async (req, res) => {
    const cleanedName = cleanName(req.params.name);
    const audioFiles = await getAudioFiles();
    res.send(pug.renderFile(path.join(viewsDir, 'dashboard-management.pug'), {
      baseUrl: req.baseUrl,
      audioFiles,
      themeColors: dashboardState.get(cleanedName).themeColors,
      name: req.params.name,
      serviceVersion: process.env.npm_package_version,
    }));
  }));

  // Dashboard POST handler
  router.post('/dashboard(-management)?/:name', handleRouteError((req) => {
    const cleanedName = cleanName(req.params.name);
    const { actions } = req.body;

    // eslint-disable-next-line complexity
    actions.forEach((action) => {
      switch (action.name) {
        case 'setActive':
          dashboardState.get(cleanedName).active = action.value;
          break;

        case 'setStarted':
          dashboardState.get(cleanedName).started = action.value;
          break;

        case 'addUrl':
          if (
            action.value != null
            && typeof action.value === 'object'
            && !Array.isArray(action.value)
            && typeof action.value.id === 'string'
            && typeof action.value.url === 'string'
          ) {
            dashboardState.get(cleanedName).urls.push(action.value);
          } else {
            // Ignore bad url elements
            return;
          }
          break;

        case 'removeUrl':
          dashboardState.get(cleanedName).urls = dashboardState
            .get(cleanedName).urls
            .filter(url => url.id !== action.value);
          break;

        case 'setUrlOnReload': {
          const targetUrl = dashboardState
            .get(cleanedName).urls
            .find(url => url.id === action.value.id);

          if (targetUrl) {
            targetUrl.reloadOnFocus = action.value.value;
          } else {
            // Ignore values we cannot find
            return;
          }
          break;
        }

        case 'setInterval': {
          const intervalValue = parseInt(action.value, 10) || 20;
          dashboardState.get(cleanedName).rotationInterval = intervalValue;
          break;
        }

        case 'setThemeColor':
          dashboardState.get(cleanedName).themeColors[action.value.name] = action.value.rgbString;
          break;

        default:
          // Do nothing
      }

      /*
        Send the action to everyone via socket
        This check is intentionally extra strict, we only allow specific actions
        to be broadcast because broadcasting stateful actions wouldn't make sense
      */
      if (
        action.broadcast === true
        && ['showBlah', 'playAudio', 'playVoice'].includes(action.name)
      ) {
        sendAll(action.name, action.value);
      } else {
        send(cleanedName, action.name, action.value);
      }
    });

    return {
      result: '👍',
      roomName: cleanedName,
      clientsInRoom: clientsInRoom(cleanedName),
      versionId,
    };
  }));

  // 404 route
  router.get('*', (req, res) => {
    const dummyNames = [
      'banana',
      'orange',
      'mango',
      'pear',
      'cherry',
      'avocado',
      'melon',
      'lime',
      'kiwi',
      'peach',
      'tomato',
      'potato',
      'lemon',
      'apple',
      'blueberry',
      'strawberry',
      'raspberry',
    ];
    const dummyName = dummyNames[Math.floor(Math.random() * dummyNames.length)];

    res.send(pug.renderFile(path.join(viewsDir, '404.pug'), {
      dummyName,
      baseUrl: req.baseUrl,
      themeColors: constants.defaultInitialState.themeColors,
      serviceVersion: process.env.npm_package_version,
    }));
  });

  return router;
};
