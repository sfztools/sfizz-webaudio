import SfizzNode from './sfizz-node.js';

class SfizzApp {

  constructor() {
    this._kbKeyShortcuts = [
      'z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm',
      'q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u', 'i'
    ]
    this._overlay = null;
    this._keyboard = null;
    this._keyboardButtons = null;
    this._reloadButton = null;
    this._context = null;
    this._synthNode = null;
    this._volumeNode = null;
    this._toggleState = false;
    this._editor = null;
    this._ctrlDown = false;
    this._noteStates = new Array(128);
    for (let i = 0; i < 128; i++) {
      this._noteStates[i] = { midiState: false, mouseState: false, keyboardState: false, element: undefined, whiteKey: undefined };
    }
    this._kbOctaveShift = 5;
    this._numRegions = null;
    this._activeVoices = null;
    this._leftControlColumn = null;
    this._sliders = new Array(512);
    for (let i = 0; i < 512; i++) {
      this._sliders[i] = { used: false, label: '', default: 0.0, element: undefined, input: undefined };
    }
  }

  _initializeView() {
    this._overlay = document.getElementById('overlay');
    this._reloadButton = document.getElementById('reload-text');
    this._reloadButton.addEventListener(
      'mouseup', () => this._reloadSfz());
    this._keyboard = document.getElementById('keyboard');
    this._keyboardButtons = document.getElementById('keyboard-buttons');
    this._keyboardButtons = document.getElementById('keyboard-buttons');
    this._numRegions = document.getElementById('num-regions');
    this._activeVoices = document.getElementById('active-voices');
    this._leftControlColumn = document.getElementById('left-control-column');

    $('#octave-down').on('mousedown', () => {
      if (this._kbOctaveShift > 0)
        this._kbOctaveShift--;

      this._updateKeyboardLabels();
    });

    $('#octave-up').on('mousedown', () => {
      if (this._kbOctaveShift < 7)
        this._kbOctaveShift++;

      this._updateKeyboardLabels();
    });
  }

  _reloadSfz() { 

    this._sliders.forEach((slider) => {
      slider.used = false;
      slider.element = undefined;
      slider.input = undefined;
    });

    while (this._leftControlColumn.firstChild)
      this._leftControlColumn.removeChild(this._leftControlColumn.firstChild);

    this._post({ type: 'text', sfz: this._editor.getValue() });
  }

  _setupKeyCaptures() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault(); // Prevent the Save dialog to open
        this._reloadSfz();
        return;
      }

      if (this._editor.isFocused())
        return;

      this._kbKeyShortcuts.some((shortcut, idx) => {
        if (e.key == shortcut) {
          const note = this._kbOctaveShift * 12 + idx;
          const state = this._noteStates[note];
          if (state.keyboardState)
            return;

          if (!state.mouseState && !state.midiState)
            this._noteOn(note, 0.8);

          this._noteStates[note].keyboardState = true;
          this._updateKeyboardState(note);

          return true;
        }
      });
    });

    document.addEventListener('keyup', e => {
      if (this._editor.isFocused())
        return;

      this._kbKeyShortcuts.some((shortcut, idx) => {
        if (e.key == shortcut) {
          const note = this._kbOctaveShift * 12 + idx;
          const state = this._noteStates[note];

          if (!state.mouseState && !state.midiState)
            this._noteOff(note, 0.8);

          this._noteStates[note].keyboardState = false;
          this._updateKeyboardState(note);

          return true;
        }
      });
    });
  }

  _setupEditor() {
    this._editor = ace.edit("editor");
    ace.config.set('basePath', 'https://pagecdn.io/lib/ace/1.4.12/')
    this._editor.setKeyboardHandler("ace/keyboard/sublime");
    this._editor.commands.addCommand({
      name: 'reload',
      bindKey: { win: 'Ctrl-S', mac: 'Command-S' },
      exec: (editor) => this._reloadSfz(),
      readOnly: true, // false if this command should not apply in readOnly mode
    });
  }

  _setupWebMidi() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ name: "midi", sysex: false })
        .then((midiAccess) => {
          var devicesNames = [];
          midiAccess.inputs.forEach((input, idx) => {
            input.onmidimessage = this._dispatchMIDIMessage.bind(this);
            devicesNames.push(input.name);
          })
          
          if (devicesNames.length > 0) {
            document.getElementById("connected-devices").textContent = 
              'Connected devices: ' + devicesNames.join(', ');
          }
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
        var element = this._sliders[number].element;
        if (element != undefined)
          element.slider('set value', value, false);

        var input = this._sliders[number].input;
        if (input != undefined)
          input.val(parseFloat(value.toFixed(4)));

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

  _onMessage(message) { 
    if (message.data.numRegions != null)
      this._numRegions.textContent = message.data.numRegions;

    if (message.data.activeVoices != null) 
      this._activeVoices.textContent = message.data.activeVoices;

    if (message.data.cc != null) {
      var slider = this._sliders[message.data.cc];
      slider.used = true;
      if (message.data.label != '')
        slider.label = message.data.label;
      else
        slider.label = 'CC ' + message.data.cc;

      slider.default = message.data.default;


      const sliderId = 'slider-' + message.data.cc;
      const inputId = 'slider-input-' + message.data.cc;
      var newSlider = document.createElement('div');
      newSlider.innerHTML = `<span>${slider.label}</span> <div class="ui slider" id="${sliderId}"></div> <div class="ui input"><input type="text" id="${inputId}"></div>`
      this._leftControlColumn.appendChild(newSlider);

      var jqSlider = $('#' + sliderId).attr('class', 'ui slider');
      var jqInput = $('#' + inputId);
      jqSlider.slider({
          min: 0, max: 1, step: 0,
          onMove: (element, value) => {
            this._post({ type: 'cc', number: message.data.cc, value: value });
            jqInput.val(parseFloat(value.toFixed(4)));
          }
        })
        .slider('set value', message.data.value)
        .on('dblclick', () => jqSlider.slider('set value', message.data.default ));
      jqInput.on('change', () => {
        const floatVal = parseFloat(jqInput.val());
        if (floatVal != NaN && floatVal >= 0 && floatVal <= 1) {
          jqSlider.slider('set value', floatVal) 
        } else {
          jqInput.val(jqSlider.slider('get value'));
        }
      });

      slider.element = jqSlider;
      slider.input = jqInput;
    }
  }

  async _initializeAudio() {
    this._context = new AudioContext();
    this._context.audioWorklet.addModule('./sfizz-processor.js').then(() => {
      this._synthNode = new SfizzNode(this._context);
      this._volumeNode = new GainNode(this._context, { gain: 0.25 });
      this._synthNode.connect(this._volumeNode)
        .connect(this._context.destination);
      this._synthNode.port.onmessage = this._onMessage.bind(this);
      
      this._overlay.style.display = "none";
      this._reloadButton.classList.remove('disabled');
      this._context.resume();
      this._reloadSfz();
    });
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

  _updateKeyboardLabels() {
    const start = this._kbOctaveShift * 12;
    const stop = this._kbOctaveShift * 12 + this._kbKeyShortcuts.length;
    this._noteStates.forEach((e, idx) => {
      if (!e.element)
        return;

      if (idx < start || idx >= stop) {
        e.element.textContent = "";
      } else {
        e.element.textContent = this._kbKeyShortcuts[idx - start];
      }

      if (e.keyboardState && !e.midiState && !e.mouseState)
        this._noteOff(idx);
      
        e.keyboardState = false;
      this._updateKeyboardState(idx);
    });
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
          if ((e.buttons & 1)) {
            if (!state.midiState && !state.keyboardState)
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
    const keyBoardWidth = whiteCount * whiteKeyWidth;
    this._keyboard.style.width = keyBoardWidth.toString() + 'px'; // resize the keyboard to center it
    this._keyboardButtons.style.width = keyBoardWidth.toString() + 'px';
    this._updateKeyboardLabels();
  }

  onWindowLoad() {
    this._initializeView();
    this._buildKeyboard();
    this._setupEditor();
    document.body.addEventListener('click', () => {
      this._initializeAudio();
      this._setupKeyCaptures();
      this._setupWebMidi();
    }, { once: true });
  }
}

const sfizzApp = new SfizzApp();
window.addEventListener('load', () => sfizzApp.onWindowLoad());
