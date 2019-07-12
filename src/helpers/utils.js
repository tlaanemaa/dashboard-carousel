const fs = require('fs');
const path = require('path');
const constants = require('./constants');

module.exports.writeFile = (filePath, data) => new Promise((resolve, reject) => {
  fs.writeFile(
    filePath,
    data,
    err => (err ? reject(err) : resolve()),
  );
});

// Name cleaning helper
module.exports.cleanName = name => (typeof name === 'string' ? name.trim().toLowerCase() : '');

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

module.exports.getAudioFiles = () => new Promise((resolve, reject) => {
  fs.readdir(constants.folders.audio, (err, files) => {
    if (err) {
      reject(err);
    } else {
      resolve(
        files
          .filter(file => path.extname(file) === '.mp3')
          .map(file => ({
            file,
            name: capitalize(file.replace(path.extname(file), '')),
          })),
      );
    }
  });
});

module.exports.ensureFolderExistsSync = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};

// General error handler for http routes
module.exports.handleRouteError = routeHandler => async (req, res) => {
  try {
    const result = await routeHandler(req, res);
    if (!res.headersSent) {
      res.status(200).json(result);
    }
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json(e.message);
    }
  }
};

// A helper to convert hex to rgb
module.exports.hexToRgb = (hex) => {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const expandedHex = hex.replace(
    shorthandRegex,
    (m, r, g, b) => r + r + g + g + b + b,
  );

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(expandedHex);
  return (
    result
      ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
      : null
  );
};

module.exports.rgbToString = rgb => `${rgb.r}, ${rgb.g}, ${rgb.b}`;
