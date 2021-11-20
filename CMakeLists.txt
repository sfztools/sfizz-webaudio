project(sfizz-webaudio)

set(SFIZZ_TESTS OFF CACHE BOOL "" FORCE)
set(SFIZZ_LV2 OFF CACHE BOOL "" FORCE)
set(SFIZZ_LV2_UI OFF CACHE BOOL "" FORCE)
set(SFIZZ_VST OFF CACHE BOOL "" FORCE)
set(SFIZZ_CLIENTS OFF CACHE BOOL "" FORCE)
add_subdirectory(sfizz)

add_executable(sfizz-webaudio)
target_sources(sfizz-webaudio PRIVATE sfizz_webaudio.cpp)
configure_file(export-es6.js export-es6.js COPYONLY)
target_link_libraries(sfizz-webaudio PRIVATE sfizz::sfizz)
set_target_properties(sfizz-webaudio PROPERTIES LINK_FLAGS 
    "--bind --post-js export-es6.js -s ENVIRONMENT=web -s SINGLE_FILE=1 -s WASM=1 -s WASM_ASYNC_COMPILATION=0")