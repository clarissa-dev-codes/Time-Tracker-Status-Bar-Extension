# Ducky Time Tracker & Focus Companion 🦆⏱️

A smart, feature-rich **Visual Studio Code** extension designed to monitor active coding duration, keep you focused with a built-in Pomodoro timer, and provide a reactive coding mascot in your editor's sidebar panel!

---

### 🌟 Features

* **Interactive Ducky Sidebar Companion:** Reacts dynamically to your coding activity (Active, Idle/Paused, or Break Enforcer states).
* **Hue-Rotation Style Customizer:** Color-tint slider card that saves hue preferences locally.
* **Smart Boundary Resets:** Automatically detects new days or workspace changes, saving stats and resetting daily metrics.
* **Languages Breakdown:** Displays real-time telemetry logs of time spent per file extension.
* **Integrated Pomodoro Timer:** Keep track of structured 25-minute focus sessions directly from the panel.
* **Enterprise-Grade Security Sandbox:** Built with a secure CSP Nonce model for safe webview events.

---

### 📥 Installation (Manual VSIX)

1. Navigate to the **Releases** section on the GitHub repository page.
2. Download the latest `.vsix` bundle from **Assets**.
3. Open **VS Code** and press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS).
4. Click the `...` (**More Actions**) icon in the top-right of the Extensions panel and select **Install from VSIX...**.

---

### 🛠️ Local Development

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com
   cd Time-Tracker-Status-Bar-Extension
   npm install
   ```
2. Open in VS Code (`code .`) and press **F5** to start the Extension Development Host.
3. Package locally using `npx vsce package`.

---

### 📄 License
Distributed under the **GPL-3.0 License**.
