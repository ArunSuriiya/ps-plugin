#!/bin/bash

echo "=========================================="
echo "   Photoshop Asset Library Installer"
echo "=========================================="
echo ""

PLUGIN_ID="com.antigravity.asset-library"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

FILES=(manifest.json index.html main.js ps-host.js ai-host.js storage.js style.css)

# ─── Install to user External folder ───
USER_DIR="$HOME/Library/Application Support/Adobe/UXP/Plugins/External/$PLUGIN_ID"
echo "1. Installing to user External folder..."
mkdir -p "$USER_DIR"
for f in "${FILES[@]}"; do cp "$SCRIPT_DIR/$f" "$USER_DIR/"; done

# ─── Install to user Developer folder ───
DEV_DIR="$HOME/Library/Application Support/Adobe/UXP/Plugins/Developer/$PLUGIN_ID"
echo "2. Installing to Developer folder..."
mkdir -p "$DEV_DIR"
for f in "${FILES[@]}"; do cp "$SCRIPT_DIR/$f" "$DEV_DIR/"; done

# ─── Prevent PS.json from blocking plugin discovery ───
# Photoshop writes {"plugins":[]} to PS.json on exit/crash.
# When UXP finds this file, it skips scanning External/Developer folders.
# Fix: delete it and lock the directory so PS cannot recreate it.
REGISTRY_DIR="$HOME/Library/Application Support/Adobe/UXP/PluginsInfo/v1"
REGISTRY_FILE="$REGISTRY_DIR/PS.json"
echo "3. Preventing plugin registry interference..."
if [ -f "$REGISTRY_FILE" ]; then
    chmod 755 "$REGISTRY_DIR" 2>/dev/null
    rm -f "$REGISTRY_FILE"
fi
chmod 555 "$REGISTRY_DIR" 2>/dev/null

echo ""
echo "=========================================="
echo "   INSTALLATION SUCCESSFUL!"
echo "=========================================="
echo ""
echo "IMPORTANT - Next steps:"
echo "  1. Fully QUIT Photoshop (Cmd+Q)"
echo "  2. Reopen Photoshop"
echo "  3. Go to: Plugins → Asset Library"
echo ""
echo "If plugin doesn't appear:"
echo "  → Photoshop → Settings → Plugins"
echo "  → Enable 'Allow Unknown Third Party Plugins'"
echo "  → Restart Photoshop"
echo ""
