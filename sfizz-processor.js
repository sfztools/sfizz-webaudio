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

import Module from './build/sfizz.wasm.js';
import WASMAudioBuffer from './util/WASMAudioBuffer.js';

// Web Audio API's render block size
const NUM_FRAMES = 128;

class SfizzProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Create an instance of Synthesizer and WASM memory helper. Then set up an
    // event handler for MIDI data from the main thread.
    this._synth = new Module.SfizzWrapper(sampleRate);
    this._leftBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1);
    this._rightBuffer = new WASMAudioBuffer(Module, NUM_FRAMES, 1, 1);
    this.port.onmessage = this._handleMessage.bind(this);
  }

  process(inputs, outputs) {
    // Call the render function to fill the WASM buffer. Then clone the
    // rendered data to process() callback's output buffer.
    this._synth.render(this._leftBuffer.getPointer(), this._rightBuffer.getPointer(), NUM_FRAMES);
    outputs[0][0].set(this._leftBuffer.getF32Array());
    outputs[1][0].set(this._rightBuffer.getF32Array());

    return true;
  }

  _handleMessage(event) {
    const data = event.data;
    switch (data.type) {
      case 'note_on':
        this._synth.noteOn(0, data.number, data.value);
        break;
      case 'note_off':
        this._synth.noteOff(0, data.number, data.value);
        break;
      case 'cc':
        this._synth.cc(0, data.number, data.value);
        break;
      case 'aftertouch':
        this._synth.aftertouch(0, data.value);
        break;
      case 'pitch_wheel':
        this._synth.pitchWheel(0, data.value);
        break;
      case 'text':
        console.log(data.sfz);
        this._synth.load(data.sfz);
        break;
      case 'num_regions':
        this.port.postMessage({ numRegions: this._synth.numRegions() });
        break;
      case 'active_voices':
        this.port.postMessage({ activeVoices: this._synth.numActiveVoices() });
        break;
      default:
        console.log("Unknown message: ", event);
    }
  }
}

registerProcessor('sfizz', SfizzProcessor);