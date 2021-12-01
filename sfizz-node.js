
export default class SfizzNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'sfizz', { numberOfOutputs: 2 });
  }
}