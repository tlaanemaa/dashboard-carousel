const constants = require('./helpers/constants');
const { ensureFolderExistsSync } = require('./helpers/utils');

// Set up folder structure
ensureFolderExistsSync(constants.folders.base);
ensureFolderExistsSync(constants.folders.database);
ensureFolderExistsSync(constants.folders.audio);
