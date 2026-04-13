# 📸 Photoshop Asset Library - Universal Distribution (Mac & Windows)

A professional, high-stability UXP Asset Library plugin for Photoshop. Designed to help you save, manage, and search for design assets (layers, shapes, groups) with instant import and high-visibility thumbnails.

---

## 🚀 Installation Instructions (Universal)

### Option 1: Double-Click Installer (.ccx)
This is the easiest way to install on **both Mac and Windows**.

1.  Download the [Asset_Library.ccx](Asset_Library.ccx) file.
2.  **Double-click** the file.
3.  Adobe Creative Cloud Desktop will open and handle the installation.

### Option 2: Windows One-Click (No Creative Cloud Required)
Use this if you don't have the Creative Cloud desktop app or want a faster install on Windows.

1.  Download this repository as a ZIP and extract it.
2.  Double-click **`Install_Windows.bat`**.
3.  Confirm the installation and restart Photoshop.

### Option 3: Developer Mode (Mac & Windows)
Recommended if you want to modify or debug the plugin.

1.  **Install Tool**: Install the [Adobe UXP Developer Tool](https://developer.adobe.com/photoshop/uxp/devtool/) from Creative Cloud.
2.  **Add Plugin**: Open the tool, click **"Add Plugin"**, and select the `manifest.json` from this repository.
3.  **Load**: Ensure Photoshop is open, then click **"Load"** in the tool.

### Option 4: Manual Installation
If you prefer to "paste" the folder manually:

- **Windows path**:
  Press `Win + R`, paste `%AppData%\Adobe\UXP\Plugins\`, and drop the folder inside.
- **Mac path**:
  Press `Cmd + Shift + G`, paste `~/Library/Application Support/Adobe/UXP/Plugins/`, and drop the folder inside.

---

## 🛠 Features
- **Cross-Platform**: Works perfectly on Windows and macOS.
- **2-Column Responsive Grid**: Beautiful, fluid display of your assets.
- **Hover-to-Manage**: Delete buttons only appear when you hover for a clean UI.
- **One-Click Save**: Select any layer in Photoshop and click `+ SAVE SELECTION`.
- **Search & Filter**: Find assets instantly by name.
- **Local Storage**: Assets are kept on your machine for privacy and speed.

---

## ⚠️ Troubleshooting
- **Black Screen**: Go to the UWP Developer Tool and click **Reload**.
- **Windows Missing Folder**: Ensure you are looking in `Roaming` AppData, not `Local`.
- **Mac Permissions**: Ensure Photoshop has "Full Disk Access" in System Settings.

---

## 👨‍💻 Repository
[https://github.com/ArunSuriiya/ps-plugin](https://github.com/ArunSuriiya/ps-plugin)
