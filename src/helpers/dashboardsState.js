const path = require('path');
const fs = require('fs');
const deepMerge = require('deepmerge');
const constants = require('./constants');
const { writeFile } = require('./utils');

// Path where we expect to the database file
const dbFilePath = path.resolve(constants.folders.database, 'dashboardState.json');

// Blank state object, used to initialize the state if needed
const blankState = {};

// A helper function to read in the initial state from db file.
// This will throw an error if the read or parse of the DB file fails
const readDbFile = () => {
  // Create an initial DB file if one doesn't exist
  if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(dbFilePath, JSON.stringify(blankState));
  }

  fs.accessSync(dbFilePath, fs.constants.R_OK);
  const dbString = fs.readFileSync(dbFilePath).toString();
  return JSON.parse(dbString);
};

// Migration for urls to add new properties
const migrateURLs = urls => urls.map((url, i) => {
  const baseUrlObject = {
    url,
    id: i,
    reloadOnFocus: false,
  };

  return typeof url === 'string' ? baseUrlObject : { ...baseUrlObject, ...url };
});

class DashboardState {
  constructor() {
    this.stateWriteTimeout = null;
    this.state = readDbFile();

    /*
      Deep merge all new state items with default state so
      that new keys get initialized if they are added
    */
    this.state = Object.keys(this.state).reduce(
      (newState, key) => {
        // eslint-disable-next-line no-param-reassign
        newState[key] = deepMerge(constants.defaultInitialState, this.state[key]);
        // eslint-disable-next-line no-param-reassign
        newState[key].urls = migrateURLs(newState[key].urls);
        return newState;
      },
      blankState,
    );

    // Schedule a write of any potential changes to file
    this.scheduleDbWrite();
  }

  exists(name) {
    return this.state[name] != null;
  }

  get(name) {
    if (!this.exists(name)) {
      this.state[name] = { ...constants.defaultInitialState };

      // Clone urls object so we can extend it
      this.state[name].urls = [...this.state[name].urls];
    }

    // Schedule a db write at every get as a convenience
    // since most reads result in a change right after
    this.scheduleDbWrite();
    return this.state[name];
  }

  scheduleDbWrite(delay = 100) {
    if (this.stateWriteTimeout) {
      clearTimeout(this.stateWriteTimeout);
      this.stateWriteTimeout = null;
    }

    // Give the write a bit of delay to allow changes to pile up
    this.stateWriteTimeout = setTimeout(async () => {
      try {
        await writeFile(dbFilePath, JSON.stringify(this.state));
      } catch (e) {
        this.scheduleDbWrite();
      }
    }, delay);
  }
}

module.exports = new DashboardState();
