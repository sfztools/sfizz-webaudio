import SfizzNode from './sfizz-node.js';

class DemoApp {

  constructor() {
    this._container = null;
    this._toggleButton = null;
    this._keyboard = null;
    this._reloadButton = null;
    this._context = null;
    this._synthNode = null;
    this._volumeNode = null;
    this._toggleState = false;
    this._sfzText = null;
    this._ctrlDown = false;
    this._noteStates = new Array(128);
    for (let i = 0; i < 128; i++)
      this._noteStates[i] = { midiState: false, mouseState: false, keyboardState: false, element: undefined, whiteKey: undefined };
  }

  _initializeView() {
    this._container = document.getElementById('demo-app');
    this._toggleButton = document.getElementById('audio-toggle');
    this._toggleButton.addEventListener('mouseup', () => this._handleToggle());
    this._sfzText = document.getElementById('sfz-text');
    this._reloadButton = document.getElementById('reload-text');
    this._reloadButton.addEventListener(
      'mouseup', () => this._post({ type: 'text', sfz: this._sfzText.value }));
    this._toggleButton.disabled = false;
    this._keyboard = document.getElementById('keyboard');
  }

  _setupKeyCaptures() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault(); // Prevent the Save dialog to open
        this._post({ type: 'text', sfz: this._sfzText.value })
      }
    });
  }

  _setupWebMidi() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ name: "midi", sysex: false })
        .then((midiAccess) => {
          console.log(midiAccess);
          var inputs = midiAccess.inputs;
          for (var input of midiAccess.inputs.values())
            input.onmidimessage = this._dispatchMIDIMessage.bind(this);
        }, () => console.log("MIDI connection failure"));
    } else {
      console.log('WebMIDI is not supported in this browser.');
    }
  }

  _noteNumberToLabel(note) {
    const octave = Math.floor(note / 12 - 1);
    const noteNames = ["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"];
    const noteIdx = (note % 12);
    return noteNames[noteIdx] + octave;
  }

  _labelToNoteNumber(label) {
    const noteNames = ["c", "cs", "d", "ds", "e", "f", "fs", "g", "gs", "a", "as", "b"];
    const octave = parseInt(label.length > 3 ? label.slice(-2) : label.slice(-1));
    const noteName = label.slice(0, -1);
    const noteIdx = noteNames.findIndex((x) => noteName == x);
    if (noteIdx < 0 || octave < -1)
      return -1;


    return (octave + 1) * 12 + noteIdx;
  }

  _noteOn(note, velocity) {
    this._post({ type: 'note_on', number: note, value: velocity });
    const id = this._noteNumberToLabel(note);
    var key = document.getElementById(id);
    if (key)
      key.style.backgroundColor = "steelblue";
  };

  _noteOff(note) {
    this._post({ type: 'note_off', number: note, value: 0.0 });
    const id = this._noteNumberToLabel(note);
    var key = document.getElementById(id);
    if (key)
      key.style.backgroundColor = key.classList.contains('white') ? "white" : "black";
  };

  _dispatchMIDIMessage(message) {
    // console.log('Midi message:', message);
    var command = message.data[0];
    var number = message.data[1];
    var value = (message.data.length > 2) ? message.data[2] / 127.0 : 0; // a velocity value might not be included with a noteOff command

    switch (command) {
      case 144: { // noteOn
          const state = this._noteStates[number];
          if (value > 0) {
            if (!state.mouseState && !state.keyboardState)
              this._noteOn(number, value);

            this._noteStates[number].midiState = true;
          } else {
            if (!state.mouseState && !state.keyboardState)
              this._noteOff(number, value);

            this._noteStates[number].midiState = false;
          }
          this._updateKeyboardState(number);
        }
        break;
      case 128: { // noteOff
          const state = this._noteStates[number];
          if (!state.mouseState && !state.keyboardState)
            this._noteOff(number, value);

          this._noteStates[number].midiState = false;
          this._updateKeyboardState(number);
        }
        break;
      case 176: // cc
        this._post({ type: 'cc', number: number, value: value });
        break;
      case 208: // cc
        this._post({ type: 'aftertouch', value: value });
        break;
      case 224: // pitch wheel
        var pitch = (((message.data[2] << 7) + message.data[1]) - 8192);
        pitch = Math.max(-8191, Math.min(8191, pitch)) / 8191.0;
        this._post({ type: 'pitch_wheel', value: pitch });
        break;
    }
  }

  async _initializeAudio() {
    this._context = new AudioContext();
    this._context.audioWorklet.addModule('./sfizz-processor.js').then(() => {
      this._synthNode = new SfizzNode(this._context);
      this._volumeNode = new GainNode(this._context, { gain: 0.25 });
      this._synthNode.connect(this._volumeNode)
        .connect(this._context.destination);

      this._toggleButton.classList.remove(['disabled', 'loading']);
      this._reloadButton.classList.remove('disabled');
      this._handleToggle();
    });
  }

  _handleToggle() {
    this._toggleState = !this._toggleState;
    if (this._toggleState) {
      this._context.resume();
      this._toggleButton.textContent = 'Disable';
      this._toggleButton.classList.remove('green');
      this._toggleButton.classList.add('red');
    } else {
      this._context.suspend();
      this._toggleButton.classList.remove('red');
      this._toggleButton.classList.add('green');
      this._toggleButton.textContent = 'Enable';
    }
  }

  _post(message) {
    this._synthNode.port.postMessage(message);
  }

  _updateKeyboardState(note) {
    const state = this._noteStates[note];
    if (!state.element)
      return;

    if (!state.midiState && !state.mouseState && !state.keyboardState) {
      if (state.whiteKey == true)
        this._noteStates[note].element.style.backgroundColor = 'white';
      else if (state.whiteKey == false)
        this._noteStates[note].element.style.backgroundColor = 'black';
    } else {
      this._noteStates[note].element.style.backgroundColor = 'steelblue';
    }
  }

  _buildKeyboard() {
    document.getElementById('keyboard-prototype').hidden = false;
    var whitePrototype = document.getElementById('white-prototype');
    var blackPrototype = document.getElementById('black-prototype');
    const whiteKeyWidth = whitePrototype.offsetWidth;
    const blackKeyWidth = blackPrototype.offsetWidth;
    const whiteKeyHeight = whitePrototype.offsetHeight;
    const blackKeyHeight = blackPrototype.offsetHeight;
    document.getElementById('keyboard-prototype').hidden = true;
    const keyNames = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
    const octaveWidth = keyNames.length * whiteKeyWidth;
    const blackOffset = whiteKeyWidth - blackKeyWidth / 2;
    const blackPositions = [0, 1, 3, 4, 5];
    var whiteCount = 0;

    var makeKey = (pos, id, cls) => {
      var key = document.createElement('button');
      key.className = cls;
      key.style = 'left: ' + pos + 'px;';
      key.id = id;
      const note = this._labelToNoteNumber(id);
      this._noteStates[note].element = key;

      if (cls == 'white') {
        whiteCount += 1;
        this._noteStates[note].whiteKey = true;
      } else {
        this._noteStates[note].whiteKey = false;
      }

      if (note >= 0) {
        const keyHeight = (cls == 'white') ? whiteKeyHeight : blackKeyHeight;
        key.addEventListener('mousedown', (e) => {
          const state = this._noteStates[note];
          if (!state.midiState 
              && !state.keyboardState)
            this._noteOn(note, e.offsetY / keyHeight);

          this._noteStates[note].mouseState = true;
          this._updateKeyboardState(note);
        });
        key.addEventListener('mouseup', () => {
          const state = this._noteStates[note];
          if (!state.midiState && !state.keyboardState)
            this._noteOff(note);
            
          this._noteStates[note].mouseState = false;
          this._updateKeyboardState(note);
        });
        key.addEventListener('mouseleave', () => {
          const state = this._noteStates[note];
          if (state.mouseState && !state.midiState && !state.keyboardState)
            this._noteOff(note);
            
          this._noteStates[note].mouseState = false;
          this._updateKeyboardState(note);
        });
        key.addEventListener('mouseenter', (e) => {
          const state = this._noteStates[note];
          if ((e.buttons & 1) && !state.midiState && !state.keyboardState) {
            this._noteOn(note, e.offsetY / keyHeight);
            
            this._noteStates[note].mouseState = true;
          }
          this._updateKeyboardState(note);
        });
      }
      this._keyboard.appendChild(key);
    };

    var makeOctave = (shift, octaveNumber) => {
      keyNames.forEach((keyName, idx) =>
        makeKey(shift + idx * whiteKeyWidth, keyName + octaveNumber, 'white'));
      blackPositions.forEach((whiteIdx) =>
        makeKey(shift + whiteIdx * whiteKeyWidth + blackOffset, keyNames[whiteIdx] + 's' + octaveNumber, 'black'));
    };

    makeKey(0, 'a0', 'white');
    makeKey(whiteKeyWidth, 'b0', 'white');
    makeKey(blackOffset, 'as0', 'black');
    for (let i = 1; i < 8; i++)
      makeOctave((i - 1) * octaveWidth + 2 * whiteKeyWidth, i);
    makeKey(7 * octaveWidth + 2 * whiteKeyWidth, 'c8', 'white');
    this._keyboard.lastChild.style.borderRight = 'solid 1px';
    this._keyboard.style.width = (whiteCount * whiteKeyWidth).toString() + 'px'; // resize the keyboard to center it
  }

  onWindowLoad() {
    this._initializeView();
    this._buildKeyboard();
    document.body.addEventListener('click', () => {
      this._initializeAudio();
      this._setupKeyCaptures();
      this._setupWebMidi();
    }, { once: true });
  }
}

const demoApp = new DemoApp();
window.addEventListener('load', () => demoApp.onWindowLoad());
