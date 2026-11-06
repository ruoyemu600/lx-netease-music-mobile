#!/usr/bin/env node
/**
 * Local ARM64 build compatibility patch for react-native-quick-base64.
 *
 * This host (Ubuntu ARM64 under proot) cannot complete AGP's prefab staging step:
 * the prefab CLI exits 0, but AGP never materialises .cxx/<hash>/prefab/<abi>, so
 * CMake configuration fails with "No compatible library found".
 *
 * react-native-quick-md5 in this same project already links JSI by compiling
 * ReactCommon/jsi/jsi.cpp directly. Apply the same approach here and disable
 * prefab for this one module. Idempotent: safe to run on every npm install.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const moduleDir = path.join(root, 'node_modules/react-native-quick-base64/android')
const cmakeFile = path.join(moduleDir, 'CMakeLists.txt')
const gradleFile = path.join(moduleDir, 'build.gradle')

const cmake = `cmake_minimum_required(VERSION 3.9.0)
project(QuickBase64)

# Local build: compile JSI sources directly instead of relying on prefab.
set(PACKAGE_NAME "quickbase64")
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_EXTENSIONS OFF)

# This module never received NODE_MODULES_DIR from Gradle; derive it from the
# CMakeLists location (node_modules/react-native-quick-base64/android).
if(NOT NODE_MODULES_DIR)
  get_filename_component(NODE_MODULES_DIR "\${CMAKE_CURRENT_SOURCE_DIR}/../.." ABSOLUTE)
endif()

set(JSI_ROOT "\${NODE_MODULES_DIR}/react-native/ReactCommon")
set(JSI_SRC "\${JSI_ROOT}/jsi/jsi/jsi.cpp")

add_library(
  \${PACKAGE_NAME}
  SHARED
  ../cpp/base64.h
  ../cpp/react-native-quick-base64.cpp
  ../cpp/react-native-quick-base64.h
  cpp-adapter.cpp
  \${JSI_SRC}
)

target_include_directories(
  \${PACKAGE_NAME}
  PRIVATE
  ../cpp
  \${JSI_ROOT}
  \${JSI_ROOT}/jsi
  "\${NODE_MODULES_DIR}/react-native/React"
  "\${NODE_MODULES_DIR}/react-native/React/Base"
)

set_target_properties(
  \${PACKAGE_NAME} PROPERTIES
  CXX_STANDARD 17
  CXX_EXTENSIONS OFF
  POSITION_INDEPENDENT_CODE ON
)

find_library(log-lib log)

target_link_libraries(
  \${PACKAGE_NAME}
  \${log-lib}
  android
)
`

let changed = 0

if (!fs.existsSync(cmakeFile)) {
  console.error('[patch-quick-base64] Missing', cmakeFile)
  process.exit(1)
}
const currentCmake = fs.readFileSync(cmakeFile, 'utf8')
if (currentCmake !== cmake) {
  fs.writeFileSync(cmakeFile, cmake)
  changed++
}

if (!fs.existsSync(gradleFile)) {
  console.error('[patch-quick-base64] Missing', gradleFile)
  process.exit(1)
}
let gradle = fs.readFileSync(gradleFile, 'utf8')
if (gradle.includes('prefab true')) {
  gradle = gradle.replace(/\n\s*buildFeatures \{\n\s*prefab true\n\s*\}\n/, '\n')
  if (!gradle.includes('prefab true')) {
    fs.writeFileSync(gradleFile, gradle)
    changed++
  }
}
if (gradle.includes('prefab true')) {
  console.error('[patch-quick-base64] Could not disable prefab; upstream file layout changed')
  process.exit(1)
}

console.log(`[patch-quick-base64] ${changed ? 'patched ' + changed + ' file(s)' : 'already patched'}`)
