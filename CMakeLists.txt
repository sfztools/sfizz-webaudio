project(sfizz-webaudio)

set(SFIZZ_TESTS OFF CACHE BOOL "" FORCE)
set(SFIZZ_LV2 OFF CACHE BOOL "" FORCE)
set(SFIZZ_LV2_UI OFF CACHE BOOL "" FORCE)
set(SFIZZ_VST OFF CACHE BOOL "" FORCE)
set(SFIZZ_RENDER OFF CACHE BOOL "" FORCE)
set(SFIZZ_JACK OFF CACHE BOOL "" FORCE)
add_subdirectory(sfizz)

add_executable(sfizz-webaudio)
target_sources(sfizz-webaudio PRIVATE sfizz_webaudio.cpp)
target_link_libraries(sfizz-webaudio PRIVATE sfizz::sfizz)
set_target_properties(sfizz-webaudio PROPERTIES 
    LINK_FLAGS "--bind -s ENVIRONMENT=web -s ALLOW_MEMORY_GROWTH=1 -s SINGLE_FILE=1 -s WASM=1 -s WASM_ASYNC_COMPILATION=0"
    OUTPUT_NAME sfizz.wasm
)

    