add_library(ScreenCapturer SHARED
    ${CMAKE_CURRENT_SOURCE_DIR}/init.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/capture.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/findWindow.cpp
)
target_link_libraries(ScreenCapturer ${NODE_LIB} Dwmapi)

install(IMPORTED_RUNTIME_ARTIFACTS ScreenCapturer RUNTIME)