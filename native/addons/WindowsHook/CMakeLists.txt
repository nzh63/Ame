add_library(WindowsHook SHARED
    ${CMAKE_CURRENT_SOURCE_DIR}/init.cpp
)
target_link_libraries(WindowsHook ${NODE_LIB})

install(IMPORTED_RUNTIME_ARTIFACTS WindowsHook RUNTIME)