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

    void noteOn(uint8_t note)
    {
        synth.hdNoteOn(0, note, 1.0f);
    }

    void noteOff(uint8_t note)
    {
        synth.hdNoteOff(0, note, 0.0f);
    }

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
      .function("noteOff", &SfizzWrapper::noteOff)
      .function("noteOn", &SfizzWrapper::noteOn)
      .function("render", &SfizzWrapper::render, allow_raw_pointers());
}
