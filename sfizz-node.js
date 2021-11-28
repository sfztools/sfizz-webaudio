
export default class SfizzNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'sfizz', { numberOfOutputs: 2 });
    this._numRegions = 0;
    this._activeVoices = 0;
    this.port.onmessage = this._onMessage.bind(this);
  }

  get numRegions() { return this._numRegions; }
  get activeVoices() { return this._activeVoices; }

  _onMessage(message) {
    if (message.data.numRegions)
      this._numRegions = message.data.numRegions;

    if (message.data.activeVoices)
      this._activeVoices = message.data.activeVoices;
  }
}