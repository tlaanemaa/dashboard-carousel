const path = require('path');
const appRoot = require('app-root-path').toString();

// Decide on which folder to use as root
const rootDir = global.isRunAsCLI ? process.cwd() : appRoot;

module.exports = Object.freeze({
  folders: Object.freeze({
    base: path.resolve(rootDir, 'dashboard-files'),
    audio: path.resolve(rootDir, 'dashboard-files', 'audio'),
    database: path.resolve(rootDir, 'dashboard-files', 'database'),
  }),

  defaultInitialState: Object.freeze({
    urls: [],
    rotationInterval: 20,
    started: true,
    active: 0,
    themeColors: Object.freeze({
      '--main-bg-color': '62, 74, 111', // Main background color, rgb
      '--main-fg-color': '115, 216, 166', // Main foreground color, rgb
      '--main-accent-color': '255, 255, 255', // Main accent color, rgb
    }),
  }),
});
