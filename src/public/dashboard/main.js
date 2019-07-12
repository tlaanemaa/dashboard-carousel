// This is needed to load in the voice synth stuffs
const voiceSynth = window.speechSynthesis;

// Helper functions
const modulo = (x, y) => ((x % y) + y) % y;
const round = (x, d = 2) => {
  const factor = 10 ** d;
  return Math.round(x * factor) / factor;
};
const nextAnimationFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve));
const uid = () => Date.now().toString(32) + Math.round(Math.random() * 100000000).toString(32);

// Blah wrapper object
class Blah {
  constructor(message, attachmentPoint) {
    this.message = message;
    this.attachmentPoint = attachmentPoint;

    this.element = null;
    this.audio = null;

    if (this.isImage()) {
      this.imageBlah();
    } else if (this.isAudio()) {
      this.audioBlah();
    } else if (this.isVideo()) {
      this.videoBlah();
    } else {
      this.textBlah();
    }
  }

  textBlah() {
    this.element = document.createElement('div');
    this.element.className = 'blahElement';
    this.element.textContent = this.message;
    this.attachmentPoint.appendChild(this.element);
  }

  isImage() {
    return !!this.message.trim().match(/(.png|.jpe?g|.gif|.svg)$/i);
  }

  imageBlah() {
    this.element = document.createElement('div');
    this.element.className = 'blahElement img';
    this.element.style.backgroundImage = `url(${this.message})`;
    this.element.style.height = '45%';
    this.element.style.width = '45%';
    this.attachmentPoint.appendChild(this.element);
  }

  isAudio() {
    return !!this.message.trim().match(/(.mp3|.wav)$/i);
  }

  audioBlah() {
    try {
      this.audio = new Audio(this.message);
      this.audio.play();
    } catch (e) {
      this.showBlah(`Failed to play audio: ${e.message}`);
    }
  }

  isVideo() {
    return !!this.message.trim().match(/(.mp4|.webm|.gifv|.ogg|.mov)$/i);
  }

  videoBlah() {
    this.element = document.createElement('video');
    this.element.className = 'blahElement vid';
    this.element.style.height = '45%';
    this.element.style.width = '45%';
    this.element.autoplay = true;
    this.element.loop = true;
    const source = document.createElement('source');
    source.src = this.message;
    this.element.appendChild(source);
    this.attachmentPoint.appendChild(this.element);
  }

  delete() {
    if (this.element) {
      this.element.remove();
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.remove();
    }
  }
}

// Frame wrapper object
class Frame {
  constructor(config, attachmentPoint, index) {
    this.url = config.url;
    this.reloadOnFocus = config.reloadOnFocus;
    this.id = config.id;
    this.attachmentPoint = attachmentPoint;
    this.index = index;

    this.element = document.createElement('iframe');
    this.element.className = 'frame';
    this.element.setAttribute('src', this.url);
    this.element.setAttribute('allow', 'autoplay');
    this.setIndex(index);

    this.attachmentPoint.appendChild(this.element);
  }

  setIndex(index) {
    this.element.style.left = `${index * 100}%`;
    this.index = index;
  }

  reload() {
    this.element.src = this.url;
  }

  focus() {
    if (this.reloadOnFocus) {
      this.reload();
    }
  }

  delete() {
    this.element.remove();
  }
}

// Frame carousel object
class FrameCarousel {
  constructor(socket, roomName = window.location.pathname.split('/').pop()) {
    this.socket = socket;
    this.roomName = roomName;
    this.urlBase = window.location.pathname.replace(/\/[^/]*$/, '');

    // References to DOM nodes
    this.documentElement = document.documentElement;
    this.sliderElement = document.getElementById('slider');
    this.rootElement = document.getElementById('root');
    this.blahRoot = document.getElementById('blahRoot');
    this.buttons = {
      left: document.getElementById('leftBtn'),
      pause: document.getElementById('pauseBtn'),
      right: document.getElementById('rightBtn'),
    };

    // State variables
    this.active = null;
    this.railIndex = 0;
    this.tickIntervalTime = 1000;
    this.frames = [];
    this.tickInterval = null;
    this.startTimeout = null;
    this.railAnimationLength = 1000; // Time in ms the rail takes to animate
    this.cursorTimeout = null;

    // Method binding
    this.joinRoom = this.joinRoom.bind(this);
    this.setState = this.setState.bind(this);
    this.hideCursor = this.hideCursor.bind(this);
    this.showCursor = this.showCursor.bind(this);

    this.resetTicker();
    this.attachEventHandlers();
  }

  attachEventHandlers() {
    // Cursor event handler
    window.onmousemove = this.showCursor;

    // Global error handler
    window.onerror = message => this.send('addUrl', {
      url: `https://stackoverflow.com/search?q=[js]+"${message}"`,
      reloadOnFocus: false,
      id: uid(),
    });

    // Socket connection status handlers
    this.socket.on('connect', () => this.setConnectedStatus(true));
    this.socket.on('disconnect', () => this.setConnectedStatus(false));

    // Click handler for pause button
    this.buttons.pause.addEventListener('click', () => {
      if (this.tickInterval != null) {
        this.send('setStarted', false);
        this.stop();
      } else {
        this.send('setStarted', true);
        this.start();
      }
    });

    // Click handler for left button
    this.buttons.left.addEventListener('click', () => {
      const newActive = this.previousFrame;
      if (newActive) {
        this.setActive(newActive.id);
      }
    });

    // Click handler for right button
    this.buttons.right.addEventListener('click', () => {
      const newActive = this.nextFrame;
      if (newActive) {
        this.setActive(newActive.id);
      }
    });
  }

  joinRoom(name = this.roomName) {
    this.roomName = name;
    this.socket.emit('join', { name });

    // Set room name in DOM
    const capitalizedName = this.roomName.charAt(0).toUpperCase() + this.roomName.slice(1);
    document.title = `${capitalizedName} dashboard`;
  }

  async send(name, value = null) {
    return window.postJson(`${this.urlBase}/${this.roomName}`, { name, value });
  }

  setState(state) {
    // Clear current management dash state
    this.removeAll(false);

    // Set new state
    state.urls.map(url => this.addFrame(url, false));
    this.setActive(state.active, false);
    if (state.started) {
      this.start();
    } else {
      this.stop();
    }
    this.setTickerInterval(state.rotationInterval);

    // Set theme colors from state
    Object.keys(state.themeColors).map(name => this.setColor(name, state.themeColors[name]));
  }

  setColor(name, rgbString) {
    const cleanString = typeof rgbString === 'string' ? rgbString.trim().toLowerCase() : null;
    if (cleanString) {
      this.documentElement.style.setProperty(name, rgbString);
    }
  }

  handleFrameReloadChange(id, value) {
    const frame = this.getFrameById(id);
    if (frame) {
      frame.reloadOnFocus = value;
    }
  }

  addFrame(config, setActive = true) {
    this.frames.push(new Frame(config, this.rootElement, this.frames.length));
    if (!this.active || setActive) {
      this.setActive(config.id);
    }
  }

  removeFrame(id) {
    const lastActiveIndex = this.activeIndex;
    const activeWasRemoved = this.active ? this.active.id === id : false;

    this.frames.filter(frame => frame.id === id).map(frame => frame.delete());
    this.frames = this.frames.filter(frame => frame.id !== id);

    if (!this.frames.length) {
      this.active = null;
      this.resetRail();
    } else if (activeWasRemoved) {
      const newActive = this.getFrameByIndex(lastActiveIndex);
      if (newActive) {
        this.setActive(newActive.id);
      }
    }
  }

  removeAll() {
    this.frames.forEach(frame => frame.delete());
    this.frames = [];
    this.resetRail();
  }

  getFrameByIndex(index) {
    return this.frames[modulo(index, this.frames.length)] || this.frames[0] || null;
  }

  getFrameById(id) {
    return this.frames.find(frame => frame.id === id);
  }

  get activeIndex() {
    if (this.active) {
      const index = this.frames.indexOf(this.active);
      return index === -1 ? 0 : index;
    }

    return 0;
  }

  get nextFrame() {
    return this.getFrameByIndex(this.activeIndex + 1);
  }

  get previousFrame() {
    return this.getFrameByIndex(this.activeIndex - 1);
  }

  // Method to set an active page
  setActive(id, sendUpdate = true) {
    if (this.tickInterval != null) {
      this.stop();
      this.startTimeout = setTimeout(this.start.bind(this), this.railAnimationLength * 1.1);
    }

    this.active = this.getFrameById(id) || this.frames[0] || null;
    this.resetTicker();
    this.updateSlider();
    this.setRailIndex(this.activeIndex);
    this.repositionFrames();
    this.positionRail();

    if (this.active) {
      this.active.focus();
    }

    // Reset the rail if we get too far out but do that after the animation has finished
    if (Math.abs(this.railIndex) > 1000) {
      setTimeout(() => this.resetRail(), this.railAnimationLength * 1.5);
    }

    if (sendUpdate && this.active) {
      this.send('setActive', this.active.id);
    }
  }

  setRailIndex(newIndexModulo) {
    // Calculate left and right candidates for the new index
    const currentIndexModulo = modulo(this.railIndex, this.frames.length);
    const leftCandidate = this.railIndex - modulo(
      currentIndexModulo - newIndexModulo,
      this.frames.length,
    );
    const rightCandidate = this.railIndex + modulo(
      newIndexModulo - currentIndexModulo,
      this.frames.length,
    );

    // Choose the one that is closer, right one in case of a tie
    if (this.railIndex - leftCandidate < rightCandidate - this.railIndex) {
      this.railIndex = leftCandidate;
    } else {
      this.railIndex = rightCandidate;
    }
  }

  repositionFrames() {
    const windowStart = this.frames.length > 1 ? -1 : 0;
    const windowEnd = this.frames.length > 2 ? 1 : 0;
    for (let i = windowStart; i <= windowEnd; i += 1) {
      const index = this.railIndex + i;
      const frame = this.frames[modulo(index, this.frames.length)];
      if (frame) {
        frame.setIndex(index);
      }
    }
  }

  positionRail() {
    this.rootElement.style.transform = `translate3d(${-this.railIndex * 100}%, 0, 0)`;
  }

  async resetRail() {
    this.rootElement.classList.remove('animated');
    await nextAnimationFrame();
    this.railIndex = this.activeIndex;
    this.positionRail();
    this.repositionFrames();
    await nextAnimationFrame();
    this.rootElement.classList.add('animated');
  }

  start() {
    this.stop();
    this.buttons.pause.classList.remove('fa-play');
    this.buttons.pause.classList.add('fa-pause');
    this.tickInterval = setInterval(this.tick.bind(this), this.tickIntervalTime);
    this.tick();
  }

  stop() {
    clearTimeout(this.startTimeout);
    this.startTimeout = null;
    clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.buttons.pause.classList.remove('fa-pause');
    this.buttons.pause.classList.add('fa-play');
  }

  resetTicker() {
    this.ticker = this.intervalTime;
  }

  updateSlider() {
    this.sliderElement.style.transform = `scaleX(${round(this.ticker / this.intervalTime, 4)})`;
  }

  tick() {
    if (this.ticker <= 0) {
      const newActive = this.nextFrame;
      if (newActive) {
        this.setActive(newActive.id);
      }
    } else {
      this.ticker -= this.tickIntervalTime;
      this.updateSlider();
    }
  }

  setTickerInterval(seconds) {
    const started = this.tickInterval != null;
    if (started) {
      this.stop();
    }
    this.intervalTime = parseInt(seconds, 10) * 1000;
    this.resetTicker();
    this.updateSlider();
    if (started) {
      this.start();
    }
  }

  showBlah(message) {
    const blah = new Blah(message, this.blahRoot);
    setTimeout(() => blah.delete(), 10000);
  }

  playAudio(name) {
    try {
      const audio = new Audio(`dashboard-audio/${name}`);

      // Don't allow the audio to play more than 30 sec to avoid spam
      setTimeout(() => {
        try {
          if (audio.duration > 0 && !audio.paused) {
            audio.pause();
            audio.remove();
          }
        } catch (e) {
          this.showBlah(`Failed to stop audio: ${e.message}`);
        }
      }, 30000);

      audio.play();
    } catch (e) {
      this.showBlah(`Failed to play audio: ${e.message}`);
    }
  }

  setConnectedStatus(connected) {
    if (connected) {
      this.sliderElement.classList.remove('disconnected');
    } else {
      this.sliderElement.classList.add('disconnected');
    }
  }

  voiceSynth(text) {
    try {
      const textString = String(text).substring(0, 50);
      const utterance = new SpeechSynthesisUtterance(textString);
      const voice = voiceSynth.getVoices().find(x => x.name === 'Google UK English Male');
      utterance.voice = voice;
      voiceSynth.speak(utterance);
    } catch (e) {
      this.showBlah(`Failed to play voice: ${e.message}`);
    }
  }

  hideCursor() {
    clearTimeout(this.cursorTimeout);
    this.cursorTimeout = null;
    document.documentElement.classList.add('no-cursor');
    this.frames.map(frame => frame.element.classList.add('no-cursor'));
  }

  showCursor() {
    this.frames.map(frame => frame.element.classList.remove('no-cursor'));
    document.documentElement.classList.remove('no-cursor');
    clearTimeout(this.cursorTimeout);
    this.cursorTimeout = setTimeout(this.hideCursor, 10000);
  }
}

// Create socket and frame carousel
const socket = window.io();
const frameCarousel = new FrameCarousel(socket);

// Socket handlers
socket.on('connect', frameCarousel.joinRoom);
socket.on('currentState', frameCarousel.setState);
socket.on('setActive', id => frameCarousel.setActive(id, false));
socket.on('setStarted', start => (start ? frameCarousel.start() : frameCarousel.stop()));
socket.on('addUrl', config => frameCarousel.addFrame(config));
socket.on('removeUrl', id => frameCarousel.removeFrame(id));
socket.on('setUrlOnReload', ({ id, value }) => frameCarousel.handleFrameReloadChange(id, value));
socket.on('setInterval', value => frameCarousel.setTickerInterval(value));
socket.on('showBlah', message => frameCarousel.showBlah(message));
socket.on('playAudio', name => frameCarousel.playAudio(name));
socket.on('playVoice', text => frameCarousel.voiceSynth(text));
socket.on('reload', () => window.location.reload(true));
socket.on('setThemeColor', data => frameCarousel.setColor(data.name, data.rgbString));
