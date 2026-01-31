include(FetchContent)

FetchContent_Declare(
    ncnn
    URL https://github.com/Tencent/ncnn/releases/download/20250503/ncnn-20250503-windows-vs2022.zip
)
FetchContent_MakeAvailable(ncnn)
set (ncnn_DIR "${ncnn_SOURCE_DIR}/${ARCH}/lib/cmake/ncnn")
find_package(ncnn CONFIG REQUIRED)
file(DOWNLOAD
    https://github.com/Tencent/ncnn/raw/refs/tags/20250503/LICENSE.txt
    ${CMAKE_CURRENT_BINARY_DIR}/LICENSE.ncnn.txt
)
file(READ ${CMAKE_CURRENT_BINARY_DIR}/LICENSE.ncnn.txt LICENSE)
set(license_json "{}")
string(JSON license_json SET ${license_json} "name" "\"ncnn\"")
string(JSON license_json SET ${license_json} "homepage" "\"https://github.com/Tencent/ncnn\"")
string(JSON license_json SET ${license_json} "licenseText" "\"${LICENSE}\"")
file(WRITE ${CMAKE_CURRENT_BINARY_DIR}/license.ncnn.json "[${license_json}]")

FetchContent_Declare(
    opencv-mobile
    URL https://github.com/nihui/opencv-mobile/releases/download/v33/opencv-mobile-4.11.0-windows-vs2022.zip
)
FetchContent_MakeAvailable(opencv-mobile)
set (OpenCV_DIR "${opencv-mobile_SOURCE_DIR}/${ARCH}")
set (OpenCV_STATIC ON)
find_package(OpenCV CONFIG REQUIRED)
file(READ ${opencv-mobile_SOURCE_DIR}/${ARCH}/LICENSE LICENSE)
set(license_json "{}")
string(JSON license_json SET ${license_json} "name" "\"opencv-mobile\"")
string(JSON license_json SET ${license_json} "homepage" "\"https://github.com/nihui/opencv-mobile\"")
string(JSON license_json SET ${license_json} "licenseText" "\"${LICENSE}\"")
file(WRITE ${CMAKE_CURRENT_BINARY_DIR}/license.opencv-mobile.json "[${license_json}]")

add_library(pp-ocr-objects OBJECT
   Detector.cpp
   Recognizer.cpp
)
target_link_libraries(pp-ocr-objects
    ncnn
    ${OpenCV_LIBS}
)

add_library(PP-OCR SHARED
    binding.cpp
)
target_link_libraries(PP-OCR
    pp-ocr-objects
    ${NODE_LIB}
)

add_executable(pp-ocr-example
   EXCLUDE_FROM_ALL
   example.cpp
)
target_link_libraries(pp-ocr-example 
    pp-ocr-objects
    ${OpenCV_LIBS}
)

add_executable(Detector_test
    Detector_test.cpp
    Detector.cpp
)
target_link_libraries(Detector_test
    gtest_main
    ncnn
    ${OpenCV_LIBS}
)
add_test(NAME Detector_test COMMAND Detector_test)

add_executable(Recognizer_test
    Recognizer_test.cpp
    Recognizer.cpp
)
target_link_libraries(Recognizer_test
    gtest_main
    ncnn
    ${OpenCV_LIBS}
)
add_test(NAME Recognizer_test COMMAND Recognizer_test)

install(IMPORTED_RUNTIME_ARTIFACTS PP-OCR RUNTIME)
install(FILES 
    ${CMAKE_CURRENT_BINARY_DIR}/license.ncnn.json 
    ${CMAKE_CURRENT_BINARY_DIR}/license.opencv-mobile.json
    DESTINATION .
)