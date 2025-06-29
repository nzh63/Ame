add_library(WindowEventHook SHARED
    ${CMAKE_CURRENT_SOURCE_DIR}/init.cpp
)
target_link_libraries(WindowEventHook ${NODE_LIB})

install(IMPORTED_RUNTIME_ARTIFACTS WindowEventHook RUNTIME)