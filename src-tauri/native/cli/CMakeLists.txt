cmake_minimum_required(VERSION 3.14)
project(Ame-Native-Cli)

cmake_policy(SET CMP0135 NEW)
set(CMAKE_CXX_STANDARD 17)

add_executable(JBeijingCli JBeijingCli.cpp)
add_executable(DrEyeCli DrEyeCli.cpp)

install(TARGETS JBeijingCli DrEyeCli)
