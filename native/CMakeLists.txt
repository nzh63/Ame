cmake_minimum_required(VERSION 3.0.0)
project(Ame-NativeModule VERSION 0.1.0)

add_executable(JBeijingCli JBeijingCli.cpp)
add_executable(DrEyeCli DrEyeCli.cpp)

set(CMAKE_INSTALL_PREFIX ${PROJECT_SOURCE_DIR}/../static/native)
install(TARGETS JBeijingCli DrEyeCli)

set(CPACK_PROJECT_NAME ${PROJECT_NAME})
set(CPACK_PROJECT_VERSION ${PROJECT_VERSION})
