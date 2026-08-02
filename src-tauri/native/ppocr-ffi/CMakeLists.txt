cmake_minimum_required(VERSION 3.19)
project(Ame-PpOcr-Ffi CXX)

# Shared library exposing the C ABI declared in ppocr_ffi.h, built for the
# Rust FFI (see src-tauri/build.rs). Downloads ncnn + opencv-mobile and
# bundles them into ppocr_ffi.dll so the Rust side only needs the DLL.

cmake_policy(SET CMP0135 NEW)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
# Match the Rust toolchain's dynamic CRT (/MD).
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreadedDLL")

include(FetchContent)

if (NOT ARCH)
    set(ARCH x64)
endif ()

FetchContent_Declare(
    ncnn
    URL https://github.com/Tencent/ncnn/releases/download/20250503/ncnn-20250503-windows-vs2022.zip
)
FetchContent_MakeAvailable(ncnn)
set(ncnn_DIR "${ncnn_SOURCE_DIR}/${ARCH}/lib/cmake/ncnn")
find_package(ncnn CONFIG REQUIRED)

FetchContent_Declare(
    opencv-mobile
    URL https://github.com/nihui/opencv-mobile/releases/download/v33/opencv-mobile-4.11.0-windows-vs2022.zip
)
FetchContent_MakeAvailable(opencv-mobile)
set(OpenCV_DIR "${opencv-mobile_SOURCE_DIR}/${ARCH}")
set(OpenCV_STATIC ON)
find_package(OpenCV CONFIG REQUIRED)

add_library(ppocr_ffi SHARED
    ppocr_ffi.cpp
    Detector.cpp
    Recognizer.cpp
)
target_include_directories(ppocr_ffi PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}")
target_compile_definitions(ppocr_ffi PRIVATE PPOCR_BUILDING_DLL)
target_link_libraries(ppocr_ffi
    PRIVATE
    ncnn
    ${OpenCV_LIBS}
)

install(TARGETS ppocr_ffi RUNTIME DESTINATION bin LIBRARY DESTINATION lib ARCHIVE DESTINATION lib)
