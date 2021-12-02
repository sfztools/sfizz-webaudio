//  Copyright 2021 Paul Ferrand

//  Permission is hereby granted, free of charge, to any person obtaining a 
//  copy of this software and associated documentation files (the "Software"), 
//  to deal in the Software without restriction, including without limitation 
//  the rights to use, copy, modify, merge, publish, distribute, sublicense, 
//  and/or sell copies of the Software, and to permit persons to whom the 
//  Software is furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in 
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
//  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
//  DEALINGS IN THE SOFTWARE.

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
    this._activeVoices = 0;
    this.port.onmessage = this._handleMessage.bind(this);
  }

  process(inputs, outputs) {
    // Call the render function to fill the WASM buffer. Then clone the
    // rendered data to process() callback's output buffer.
    this._synth.render(this._leftBuffer.getPointer(), this._rightBuffer.getPointer(), NUM_FRAMES);
    outputs[0][0].set(this._leftBuffer.getF32Array());
    outputs[1][0].set(this._rightBuffer.getF32Array());
    const activeVoices = this._synth.numActiveVoices();
    if (activeVoices != this._activeVoices) {
      this.port.postMessage({ activeVoices: this._synth.numActiveVoices() });
      this._activeVoices = activeVoices;
    }
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
        this._synth.load(data.sfz);
        const usedCCs = this._synth.usedCCs();
        for (let i = 0; i < usedCCs.size(); i++) {
          const cc = usedCCs.get(i);
          var ccLabel = this._synth.ccLabel(cc);
          // Default names
          if (ccLabel == '') {
            switch(cc) {
              case 7: ccLabel = 'Volume'; break;
              case 10: ccLabel = 'Pan'; break;
              case 11: ccLabel = 'Expression'; break;
            }              
          }

          const ccValue = this._synth.ccValue(cc);
          const ccDefault = this._synth.ccDefault(cc);
          this.port.postMessage({ cc: cc, label: ccLabel, value: ccValue, default: ccDefault });
        }
        this.port.postMessage({ numRegions: this._synth.numRegions() });
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