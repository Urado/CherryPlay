cmake_minimum_required(VERSION 3.25)

project(CherryPlayAimpPlugin LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "CherryPlayAimpPlugin is supported only on Windows.")
endif()

if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
  message(FATAL_ERROR "CherryPlayAimpPlugin must be built as x64.")
endif()

set(AIMP_SDK_ROOT "D:/AIMP_SDK/Sources/Cpp" CACHE PATH "Path to the AIMP SDK C++ headers directory")

if(NOT EXISTS "${AIMP_SDK_ROOT}/apiPlugin.h")
  message(FATAL_ERROR "AIMP SDK headers were not found under AIMP_SDK_ROOT='${AIMP_SDK_ROOT}'.")
endif()

add_library(CherryPlayAimpBridge SHARED
  src/CherryPlayAimpPlugin.cpp
)

target_include_directories(CherryPlayAimpBridge PRIVATE
  "${AIMP_SDK_ROOT}"
)

target_compile_features(CherryPlayAimpBridge PRIVATE cxx_std_20)
target_compile_definitions(CherryPlayAimpBridge PRIVATE
  WIN32_LEAN_AND_MEAN
  NOMINMAX
  UNICODE
  _UNICODE
)

if(MSVC)
  target_compile_options(CherryPlayAimpBridge PRIVATE /W4 /permissive- /EHsc)
endif()

target_link_libraries(CherryPlayAimpBridge PRIVATE
  Ole32
)

set_target_properties(CherryPlayAimpBridge PROPERTIES
  OUTPUT_NAME "CherryPlayAimpBridge"
  CXX_STANDARD 20
  CXX_STANDARD_REQUIRED YES
  CXX_EXTENSIONS NO
)
