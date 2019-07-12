// Helper functions
const rgb2string = (r, g, b) => `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;

const addProtocol = url => (
  url.match(/^([a-z]+:)?\/\//i)
    ? url
    : `http://${url}`
);

const decimal2hex = (value) => {
  const hex = parseInt(value, 10).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
};

const uid = () => Date.now().toString(32) + Math.round(Math.random() * 100000000).toString(32);

class Url {
  constructor(config, attachmentPoint, onFocus, onDelete, onReloadClick) {
    this.url = config.url;
    this.reloadOnFocus = config.reloadOnFocus;
    this.id = config.id;
    this.attachmentPoint = attachmentPoint;
    this.onReloadClick = onReloadClick;

    this.baseElement = document.createElement('div');
    this.baseElement.className = 'urlBase';

    this.urlElement = document.createElement('div');
    this.urlElement.className = 'url';
    this.urlElement.textContent = config.url;
    this.urlElement.addEventListener('click', () => onFocus(this.id));
    this.baseElement.appendChild(this.urlElement);

    this.openButton = document.createElement('div');
    this.openButton.addEventListener('click', this.handleOpenClick.bind(this));
    this.openButton.className = 'url-button fas fa-external-link-alt';
    this.baseElement.appendChild(this.openButton);

    this.reloadOnFocusButton = document.createElement('div');
    this.reloadOnFocusButton.addEventListener('click', this.handleReloadClick.bind(this));
    this.reloadOnFocusButton.className = 'url-button fas fa-retweet';
    if (this.reloadOnFocus) {
      this.reloadOnFocusButton.classList.add('active');
    }
    this.baseElement.appendChild(this.reloadOnFocusButton);

    this.closeButton = document.createElement('div');
    this.closeButton.addEventListener('click', () => onDelete(this.id));
    this.closeButton.className = 'url-button fas fa-times';
    this.baseElement.appendChild(this.closeButton);

    this.attachmentPoint.appendChild(this.baseElement);
  }

  handleReloadClick() {
    this.reloadOnFocus = !this.reloadOnFocus;
    this.onReloadClick(this.id, this.reloadOnFocus);
  }

  setReloadActiveClass(active) {
    if (active) {
      this.reloadOnFocusButton.classList.add('active');
    } else {
      this.reloadOnFocusButton.classList.remove('active');
    }
  }

  handleOpenClick() {
    window.open(this.url, '_blank');
  }

  delete() {
    this.baseElement.remove();
  }

  focus() {
    this.urlElement.classList.add('active');
  }

  blur() {
    this.urlElement.classList.remove('active');
  }
}

// Main dashboard manager class
class Manager {
  constructor(socket, roomName = window.location.pathname.split('/').pop()) {
    this.socket = socket;
    this.roomName = roomName;
    this.urlBase = window.location.pathname.replace(/\/[^/]*$/, '');
    this.urls = [];

    // References to DOM nodes
    this.documentElement = document.documentElement;
    this.roomNameElement = document.getElementById('roomName');
    this.contentContainer = document.getElementById('content-container');
    this.pickerContainer = document.getElementById('color-picker-container');
    this.sliderElement = document.getElementById('slider');
    this.urlRootElement = document.getElementById('urls');
    this.addUrlElement = document.getElementById('addUrl');
    this.tickerIntervalElement = document.getElementById('intervalSeconds');
    this.blahContainer = document.getElementById('blahBox');
    this.audioButtonContainer = document.getElementById('audioButtons');
    this.voiceInput = document.getElementById('voiceInput');
    this.socketError = document.getElementById('socketError');
    this.buttons = {
      pause: document.getElementById('pauseBtn'),
      reload: document.getElementById('reloadBtn'),
      sendBlah: document.getElementById('send-blah-button'),
    };

    // State variables
    this.started = true;
    this.active = null;

    // Color pickers
    this.sendColorChange = true;
    this.colorPickers = {};
    this.colorDefaults = {
      '--main-bg-color': '62, 74, 111',
      '--main-fg-color': '115, 216, 166',
      '--main-accent-color': '255, 255, 255',
    };

    // Method binding
    this.joinRoom = this.joinRoom.bind(this);
    this.setState = this.setState.bind(this);
    this.handleUrlFocus = this.handleUrlFocus.bind(this);
    this.handleUrlDeletion = this.handleUrlDeletion.bind(this);
    this.handleUrlReloadClick = this.handleUrlReloadClick.bind(this);

    this.attachClickHandlers();
    this.initColorPickers();
  }

  attachClickHandlers() {
    // Socket connection status handlers
    this.socket.on('connect', () => this.setConnectedStatus(true));
    this.socket.on('disconnect', () => this.setConnectedStatus(false));

    // Click handler for pause button
    this.buttons.pause.addEventListener('click', () => {
      if (this.started) {
        this.send('setStarted', false);
      } else {
        this.send('setStarted', true);
      }
    });

    // Click handler for reload button
    this.buttons.reload.addEventListener('click', () => {
      this.send('reload');
    });

    // Click handler for interval save button
    this.tickerIntervalElement.addEventListener('change', () => {
      this.send('setInterval', this.tickerIntervalElement.value);
    });

    // Add url handler
    this.addUrlElement.addEventListener('keyup', (e) => {
      if (e.keyCode === 13) {
        this.send('addUrl', {
          url: addProtocol(this.addUrlElement.value),
          reloadOnFocus: false,
          id: uid(),
        });
        this.addUrlElement.value = '';
      }
    });

    // Key handler for blah container
    this.blahContainer.addEventListener('keyup', (e) => {
      if (
        e.keyCode === 13
        && !e.shiftKey
      ) {
        this.sendBlah(this.blahContainer.value);
        this.blahContainer.value = '';
      }
    });

    // Click handler for sendBlah
    this.buttons.sendBlah.addEventListener('click', () => {
      this.sendBlah(this.blahContainer.value);
      this.blahContainer.value = '';
    });

    // Click handlers for audio buttons
    if (this.audioButtonContainer) {
      this.audioButtonContainer.addEventListener('click', (e) => {
        const element = e.target.closest('.button.audio');
        if (element) {
          this.send('playAudio', element.getAttribute('name'));
        }
      });
    }

    // Enter key handler for voice box
    this.voiceInput.addEventListener('keyup', (e) => {
      if (e.keyCode === 13) {
        this.send('playVoice', this.voiceInput.value);
        this.voiceInput.value = '';
      }
    });
  }

  initColorPickers() {
    Object.keys(this.colorPickers).map(name => this.removeColorPicker(name));
    Object.keys(this.colorDefaults).map(name => this.makeColorPicker(name));
  }

  joinRoom(name = this.roomName) {
    this.roomName = name;
    this.socket.emit('join', { name });

    // Set room name in DOM
    const capitalizedName = this.roomName.charAt(0).toUpperCase() + this.roomName.slice(1);
    this.roomNameElement.textContent = capitalizedName;
    document.title = `${capitalizedName} dashboard management`;
  }

  async send(name, value = null) {
    return window.postJson(`${this.urlBase}/${this.roomName}`, { name, value });
  }

  sendBlah(text) {
    if (
      text
      && typeof text === 'string'
      && text.toLowerCase().trim()
    ) {
      return this.send('showBlah', text);
    }

    return null;
  }

  setState(state) {
    // Clear current management dash state
    this.removeAll();

    // Set new state
    state.urls.map(url => this.addUrl(url));
    this.setActive(state.active);
    if (state.started) {
      this.start();
    } else {
      this.stop();
    }
    this.setTickerInterval(state.rotationInterval);

    // Set theme colors from state
    Object.keys(state.themeColors).map(name => this.setColor(name, state.themeColors[name]));
  }

  makeColorPicker(name) {
    const node = document.createElement('div');
    this.pickerContainer.appendChild(node);

    const picker = window.Pickr.create({
      el: node,
      default: this.getColorVariable(name),
      components: {
        hue: true,
        interaction: {
          input: true,
          clear: true,
          save: true,
        },
      },
      strings: {
        clear: 'Reset',
      },
    });

    picker.on('save', (color) => {
      if (!color) {
        picker.setColor(`rgba(${this.colorDefaults[name]}, 1)`);
        return;
      }

      const rgbString = rgb2string(...color.toRGBA());
      const cleanString = typeof rgbString === 'string' ? rgbString.trim().toLowerCase() : null;
      if (!cleanString) {
        return;
      }

      this.documentElement.style.setProperty(name, rgbString);
      if (this.sendColorChange) {
        this.send('setThemeColor', { name, rgbString });
      }
    });

    this.colorPickers[name] = picker;
  }

  removeColorPicker(name) {
    const picker = this.colorPickers[name];
    if (picker instanceof window.Pickr) {
      picker.destroyAndRemove();
    }
    this.colorPickers[name] = null;
  }

  getColorVariable(name) {
    const rgbString = getComputedStyle(this.contentContainer).getPropertyValue(name);
    const hexValue = rgbString.trim().split(',').map(decimal2hex).join('');
    return `#${hexValue}`;
  }

  setColor(name, rgbString) {
    if (this.colorPickers[name]) {
      this.sendColorChange = false;
      this.colorPickers[name].setColor(`rgba(${rgbString}, 1)`);
      this.sendColorChange = true;
    }
  }

  handleUrlFocus(id) {
    this.send('setActive', id);
  }

  handleUrlDeletion(id) {
    this.send('removeUrl', id);
  }

  handleUrlReloadClick(id, value) {
    this.send('setUrlOnReload', { id, value });
  }

  handleUrlReloadChange(id, value) {
    const url = this.getUrlById(id);
    if (url) {
      url.setReloadActiveClass(value);
    }
  }

  getUrlById(id) {
    return this.urls.find(url => url.id === id);
  }

  addUrl(config) {
    this.urls.push(new Url(
      config,
      this.urlRootElement,
      this.handleUrlFocus,
      this.handleUrlDeletion,
      this.handleUrlReloadClick,
    ));
  }

  removeUrl(id) {
    this.urls.filter(url => url.id === id).forEach(url => url.delete());
    this.urls = this.urls.filter(url => url.id !== id);
  }

  removeAll() {
    this.urls.forEach(url => url.delete());
    this.urls = [];
  }

  // Method to set an active page
  setActive(id) {
    this.urls.forEach(url => url.blur());
    this.active = this.getUrlById(id);
    if (this.active) {
      this.active.focus();
    }
  }

  start() {
    this.buttons.pause.classList.remove('fa-play');
    this.buttons.pause.classList.add('fa-pause');
    this.started = true;
  }

  stop() {
    this.buttons.pause.classList.remove('fa-pause');
    this.buttons.pause.classList.add('fa-play');
    this.started = false;
  }

  setTickerInterval(seconds) {
    this.tickerIntervalElement.value = parseInt(seconds, 10);
  }

  setConnectedStatus(connected) {
    if (connected) {
      this.socketError.classList.remove('visible');
    } else {
      this.socketError.classList.add('visible');
    }
  }
}

// Create socket and management dash and theme manager
const socket = window.io();
const manager = new Manager(socket);

// Socket handlers
socket.on('connect', manager.joinRoom);
socket.on('currentState', manager.setState);
socket.on('setActive', index => manager.setActive(index));
socket.on('setStarted', start => (start ? manager.start() : manager.stop()));
socket.on('addUrl', url => manager.addUrl(url));
socket.on('removeUrl', index => manager.removeUrl(index));
socket.on('setUrlOnReload', ({ id, value }) => manager.handleUrlReloadChange(id, value));
socket.on('setInterval', value => manager.setTickerInterval(value));
socket.on('setThemeColor', data => manager.setColor(data.name, data.rgbString));
