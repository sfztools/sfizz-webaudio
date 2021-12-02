## sfizz WebAudio/WebMidi demo

This repository contains a HTML/Javascript/WebAssembly front-end for [sfizz](https://sfz.tools/sfizz), which allows prototyping of virtual instruments in the SFZ format.

### Building

This assumes you have the [emsdk](https://github.com/emscripten-core/emsdk) installed and activated.
```sh
mkdir build
cd build
emcmake cmake -DCMAKE_BUILD_TYPE=Release ..
make -j
echo "export default Module;" >> sfizz.wasm.js
```

From the `build` directory, you may then host the result on `localhost:8000` using python as
```sh
python3 -m http.server --directory ..
```