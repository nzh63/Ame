cmake_minimum_required(VERSION 3.19)
project(Ame-Native-Addons)

cmake_policy(SET CMP0135 NEW)
set(CMAKE_CXX_STANDARD 20)

include(FetchContent)

FetchContent_Declare(
    node-api-headers
    URL https://github.com/nodejs/node-api-headers/archive/refs/tags/v1.5.0.tar.gz
)
FetchContent_MakeAvailable(node-api-headers)

FetchContent_Declare(
    node-addon-api
    URL https://github.com/nodejs/node-addon-api/archive/refs/tags/v8.4.0.tar.gz
)
FetchContent_MakeAvailable(node-addon-api)

include_directories(
    "${node-api-headers_SOURCE_DIR}/include"
    "${node-addon-api_SOURCE_DIR}"
)

if ("${CMAKE_VS_PLATFORM_NAME}" STREQUAL "ARM64")
    set(ARCH arm64)
elseif ("${CMAKE_VS_PLATFORM_NAME}" STREQUAL "Win32")
    set(ARCH x86)
else ()
    set(ARCH x64)
endif ()
file(DOWNLOAD
    https://nodejs.org/dist/latest-v22.x/win-${ARCH}/node.lib
    ${CMAKE_CURRENT_BINARY_DIR}/node.lib
)

set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
set(CMAKE_SHARED_LIBRARY_SUFFIX ".node")
set(CMAKE_SHARED_LINKER_FLAGS /DELAYLOAD:NODE.EXE)
add_compile_definitions(BUILDING_NODE_EXTENSION)

file(DOWNLOAD
    https://github.com/nodejs/node-gyp/raw/refs/tags/v11.2.0/src/win_delay_load_hook.cc
    ${CMAKE_CURRENT_BINARY_DIR}/win_delay_load_hook.cc
)
add_library(win_delay_load_hook OBJECT
    ${CMAKE_CURRENT_BINARY_DIR}/win_delay_load_hook.cc
)
target_compile_definitions(win_delay_load_hook PRIVATE "HOST_BINARY=\"node.exe\"")

set(NODE_LIB ${CMAKE_CURRENT_BINARY_DIR}/node.lib win_delay_load_hook)

add_subdirectory(Process)
add_subdirectory(ScreenCapturer)
add_subdirectory(WindowEventHook)
add_subdirectory(WindowsHook)
add_subdirectory(PP-OCR)
