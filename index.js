/**
 * Copyright 2021 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import SfizzNode from './sfizz-node.js';

class DemoApp {

  constructor() {
    this._container = null;
    this._toggleButton = null;
    this._toneButton = null;
    this._reloadButton = null;
    this._context = null;
    this._synthNode = null;
    this._volumeNode = null;
    this._toggleState = false;
    this._sfzText = null;
    this._ctrlDown = false;
  }

  _initializeView() {
    this._container = document.getElementById('demo-app');
    this._toggleButton = document.getElementById('audio-toggle');
    this._toggleButton.addEventListener(
      'mouseup', () => this._handleToggle());
    this._toneButton = document.getElementById('play-note');
    this._toneButton.addEventListener(
      'mousedown', () => this._handleToneButton(true));
    this._toneButton.addEventListener(
      'mouseup', () => this._handleToneButton(false));
    this._sfzText = document.getElementById('sfz-text');
    this._reloadButton = document.getElementById('reload-text');
    this._reloadButton.addEventListener(
      'mouseup', () => this._post({ type: 'text', sfz: this._sfzText.value }));
    this._toggleButton.disabled = false;
    this._toneButton.disabled = false;
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
      navigator.requestMIDIAccess()
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

  _dispatchMIDIMessage(message) {
    // console.log('Midi message:', message);
    var command = message.data[0];
    var note = message.data[1];
    var velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command

    switch (command) {
      case 144: // noteOn
        if (velocity > 0) {
          this._post({ type: 'note_on', number: note, value: velocity / 127.0 })
        } else {
          this._post({ type: 'note_off', number: note, value: 0.0 })
        }
        break;
      case 128: // noteOff
        this._post({ type: 'note_off', number: note, value: 0.0 })
        break;
      // we could easily expand this switch statement to cover other types of commands such as controllers or sysex
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
      this._toneButton.classList.remove('disabled');
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

  _handleToneButton(isDown) {
    isDown ? this._post({ type: 'note_on', number: 60, value: 1.0 })
      : this._post({ type: 'note_off', number: 60, value: 0.0 });
  }

  onWindowLoad() {
    document.body.addEventListener('click', () => {
      this._initializeAudio();
      this._initializeView();
      this._setupKeyCaptures();
      this._setupWebMidi();
    }, { once: true });
  }
}

const demoApp = new DemoApp();
window.addEventListener('load', () => demoApp.onWindowLoad());
