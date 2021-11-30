#include <emscripten/bind.h>
#include "sfizz.hpp"

using namespace emscripten;

class SfizzWrapper {
public:
    SfizzWrapper(int32_t sampleRate)
    {
        synth.setSampleRate(static_cast<float>(sampleRate));
        synth.loadSfzString("default.sfz", "<region> sample=*saw");
    }

    void load(std::string file) { synth.loadSfzString("file.sfz", file); }

    void noteOn(int delay, uint8_t number, float value) { synth.hdNoteOn(delay, number, value); }
    void noteOff(int delay, uint8_t number, float value) { synth.hdNoteOff(delay, number, value); }
    void cc(int delay, uint8_t number, float value) { synth.hdcc(delay, number, value); }
    void aftertouch(int delay, float value) { synth.hdChannelAftertouch(delay, value); }
    void pitchWheel(int delay, float value) { synth.hdPitchWheel(delay, value); }

    int numRegions() const { return synth.getNumRegions(); }
    int numActiveVoices() const { return synth.getNumActiveVoices(); }

    void render(uintptr_t left, uintptr_t right, int32_t numFrames) {
        // Use type cast to hide the raw pointer in function arguments.
        float* output_array[2] = {
            reinterpret_cast<float*>(left),
            reinterpret_cast<float*>(right)
        };
        synth.renderBlock(output_array, numFrames);
    }

private:
    sfz::Sfizz synth;
};

EMSCRIPTEN_BINDINGS(CLASS_Synthesizer) {
  // Then expose the overridden `render` method from the wrapper class.
  class_<SfizzWrapper>("SfizzWrapper")
      .constructor<int32_t>()
      .function("load", &SfizzWrapper::load)
      .function("noteOff", &SfizzWrapper::noteOff)
      .function("noteOn", &SfizzWrapper::noteOn)
      .function("cc", &SfizzWrapper::cc)
      .function("aftertouch", &SfizzWrapper::aftertouch)
      .function("pitchWheel", &SfizzWrapper::pitchWheel)
      .function("numRegions", &SfizzWrapper::numRegions)
      .function("numActiveVoices", &SfizzWrapper::numActiveVoices)
      .function("render", &SfizzWrapper::render, allow_raw_pointers());
}
