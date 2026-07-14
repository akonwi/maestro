#!/bin/bash

# Build Maestro as a standalone macOS app bundle

set -e

cd "$(dirname "$0")/.."

APP_NAME="Maestro"
APP_DIR=".build/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

echo "Building release binary..."
swift build -c release

echo "Creating app bundle structure..."
rm -rf "${APP_DIR}"
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}"

# Copy the binary
cp ".build/release/Maestro" "${MACOS_DIR}/${APP_NAME}"

# Create Info.plist
cat > "${CONTENTS_DIR}/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Maestro</string>
    <key>CFBundleDisplayName</key>
    <string>Maestro</string>
    <key>CFBundleIdentifier</key>
    <string>com.akonwi.maestro</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>Maestro</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
PLIST

# Create PkgInfo
echo -n "APPL????" > "${CONTENTS_DIR}/PkgInfo"

echo ""
echo "✅ App bundle created at: ${APP_DIR}"
echo ""
echo "To install:"
echo "  cp -r \"${APP_DIR}\" /Applications/"
echo ""
echo "Or open in Finder:"
echo "  open .build/"
