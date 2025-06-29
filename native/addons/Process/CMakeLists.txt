add_library(Process SHARED
    ${CMAKE_CURRENT_SOURCE_DIR}/init.cpp
)
target_link_libraries(Process ${NODE_LIB} Ntdll)

install(IMPORTED_RUNTIME_ARTIFACTS Process RUNTIME)