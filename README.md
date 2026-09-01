### Time Tracker Status Bar Extension

A lightweight, distraction-free **Visual Studio Code** extension designed to monitor and display your active coding duration directly inside your editor's status bar. 

### 🌟 Features

* **Status Bar Integration:** Keep track of your coding sessions at a glance without switching windows.
* **Interactive Sidebar:** Access deep-dive metrics and logs via a clean, dedicated HTML sidebar view.
* **Automatic Pausing:** Intelligently tracks active development work so your data remains accurate.

### 📥 Installation

### Manual Installation (VSIX)

1. Navigate to the **Releases** section on the right side of this GitHub repository page.
2. Download the latest .vsix file from the **Assets** dropdown.
3. Open **VS Code**.
4. Press Ctrl+Shift+X (Windows/Linux) or Cmd+Shift+X (macOS) to open the **Extensions** view.
5. Click the ... (More Actions) menu in the top-right corner of the Extensions pane.
6. Select **Install from VSIX...** and choose the downloaded file.

### ⚙️ Configuration & Settings

This extension contributes the following settings through your VS Code settings.json: 

* timeTracker.enable: Toggle the extension tracking on or off. *(Default: true)*
* timeTracker.updateInterval: Adjust how often (in seconds) the status bar text updates. *(Default: 60)*

### 🛠️ Development & Local Setup

If you want to clone this repository and modify the extension yourself, follow these steps: 

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [Visual Studio Code](https://code.visualstudio.com/)

### Steps

1. Clone the repository: 

bash

git clone https://github.com/clarissa-dev-codes/Time-Tracker-Status-Bar-Extension.git
cd Time-Tracker-Status-Bar-Extension

Use code with caution.
2. Install dependencies: 

bash

npm install

Use code with caution.
3. Open the project in VS Code: 

bash

code .

Use code with caution.
4. Press F5 to open a new **Extension Development Host** window and test your changes live.

### 📄 License

This project is licensed under the **GPL-3.0 License** - see the [LICENSE](LICENSE) file for details.
