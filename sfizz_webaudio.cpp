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

#include <emscripten/bind.h>
#include <sstream>
#include <string_view>
#include <charconv>
#include "sfizz.hpp"
#include "sfizz/utility/bit_array/BitArray.h"

using namespace emscripten;

class SfizzWrapper
{
public:
    SfizzWrapper(int32_t sampleRate)
    {
        synth.setReceiveCallback(*client, &SfizzWrapper::staticCallback);
        synth.setSampleRate(static_cast<float>(sampleRate));
        load("<region> sample=*saw");
    }

    void load(std::string file)
    {
        synth.loadSfzString("file.sfz", file);
        synth.getCCLabels();
    }

    void noteOn(int delay, uint8_t number, float value) { synth.hdNoteOn(delay, number, value); }
    void noteOff(int delay, uint8_t number, float value) { synth.hdNoteOff(delay, number, value); }
    void cc(int delay, uint8_t number, float value) { synth.hdcc(delay, number, value); }
    void aftertouch(int delay, float value) { synth.hdChannelAftertouch(delay, value); }
    void pitchWheel(int delay, float value) { synth.hdPitchWheel(delay, value); }

    int numRegions() const { return synth.getNumRegions(); }
    int numActiveVoices() const { return synth.getNumActiveVoices(); }
    std::vector<int> usedCCs() const
    {
        const_cast<SfizzWrapper*>(this)->synth.sendMessage(*client, 0, "/cc/slots", "", nullptr);
        return usedCCs_;
    }
    std::string ccLabel(int number) const
    {
        if (number < 0)
            return {};

        lastLabel.clear();
        std::stringstream path;
        path << "/cc" << number << "/label";
        const_cast<SfizzWrapper*>(this)->synth.sendMessage(*client, 0, path.str().c_str(), "", nullptr);
        return lastLabel;
    }
    float ccValue(int number) const
    {
        if (number < 0)
            return 0.0f;

        lastCCValue = 0.0f;
        std::stringstream path;
        path << "/cc" << number << "/value";
        const_cast<SfizzWrapper*>(this)->synth.sendMessage(*client, 0, path.str().c_str(), "", nullptr);
        return lastCCValue;
    }

    float ccDefault(int number) const
    {
        if (number < 0)
            return 0.0f;

        lastCCDefault = 0.0f;
        std::stringstream path;
        path << "/cc" << number << "/default";
        const_cast<SfizzWrapper*>(this)->synth.sendMessage(*client, 0, path.str().c_str(), "", nullptr);
        return lastCCDefault;
    }

    void render(uintptr_t left, uintptr_t right, int32_t numFrames)
    {
        // Use type cast to hide the raw pointer in function arguments.
        float *output_array[2] = {
            reinterpret_cast<float *>(left),
            reinterpret_cast<float *>(right)};
        synth.renderBlock(output_array, numFrames);
    }

    static void staticCallback(void *data, int delay, const char *path, const char *sig, const sfizz_arg_t *args)
    {
        auto self = reinterpret_cast<SfizzWrapper *>(data);
        self->clientCallback(delay, path, sig, args);
    }

    void clientCallback(int delay, const char *path, const char *sig, const sfizz_arg_t *args)
    {
        unsigned indices[8];

        if (!strcmp(path, "/cc/slots") && !strcmp(sig, "b"))
        {
            usedCCs_.clear();
            ConstBitSpan bits(args[0].b->data, 8 * args[0].b->size);
            for (unsigned cc = 0; cc < 512 && cc < bits.bit_size(); ++cc)
            {
                if (bits.test(cc))
                {
                    usedCCs_.push_back(cc);
                    std::stringstream path;
                    path << "/cc" << cc << "/label";
                    synth.sendMessage(*client, delay, path.str().c_str(), "", nullptr);
                    path.clear();
                    path << "/cc" << cc << "/value";
                    synth.sendMessage(*client, delay, path.str().c_str(), "", nullptr);
                    path.clear();
                    path << "/cc" << cc << "/default";
                    synth.sendMessage(*client, delay, path.str().c_str(), "", nullptr);
                }
            }
        } else if (matchOSC("/cc&/label", path, indices) && !strcmp(sig, "s")) {
            lastLabel = args[0].s;
        } else if (matchOSC("/cc&/value", path, indices) && !strcmp(sig, "f")) {
            lastCCValue = args[0].f;
        } else if (matchOSC("/cc&/default", path, indices) && !strcmp(sig, "f")) {
            lastCCDefault = args[0].f;
        }
    }

private:
    sfz::Sfizz synth;
    sfz::ClientPtr client = synth.createClient(this);
    std::vector<int> usedCCs_;
    mutable std::string lastLabel;
    mutable float lastCCValue;
    mutable float lastCCDefault;

    bool matchOSC(const char *pattern, const char *path, unsigned *indices)
    {
        unsigned nthIndex = 0;

        while (const char *endp = std::strchr(pattern, '&'))
        {
            size_t length = endp - pattern;
            if (std::strncmp(pattern, path, length))
                return false;
            pattern += length;
            path += length;

            length = 0;
            while (std::isdigit(path[length]))
                ++length;

            auto result = std::from_chars(path, path + length, indices[nthIndex++]);
            if (result.ec != std::errc())
                return false;

            pattern += 1;
            path += length;
        }

        return !std::strcmp(path, pattern);
    }
};

EMSCRIPTEN_BINDINGS(CLASS_Synthesizer)
{
    register_vector<int>("vector<int>");
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
        .function("usedCCs", &SfizzWrapper::usedCCs)
        .function("ccLabel", &SfizzWrapper::ccLabel)
        .function("ccValue", &SfizzWrapper::ccValue)
        .function("ccDefault", &SfizzWrapper::ccDefault)
        .function("render", &SfizzWrapper::render, allow_raw_pointers());
}
