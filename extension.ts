import * as vscode from 'vscode';

let totalSeconds = 0;
let timerInterval: NodeJS.Timeout | undefined;
let idleTimeout: NodeJS.Timeout | undefined;
let currentProvider: TimeTrackerViewProvider | undefined;

let isIdle = false;
const IDLE_THRESHOLD_SECONDS = 5; 

// Storage dictionary for time spent per file type
let fileTypeStats: { [key: string]: number } = {};

export function activate(context: vscode.ExtensionContext) {
    console.log('Time Tracker Sidebar Extension with Safe File Tracking is activating...');

    const provider = new TimeTrackerViewProvider(context.extensionUri);
    currentProvider = provider;

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('time-tracker-sidebar-view', provider)
    );

    startTimer();
    resetIdleTimer();

    // --- ACTIVITY LISTENERS ---
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => onUserActivity()));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => onUserActivity()));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => onUserActivity()));
}

function startTimer() {
    if (timerInterval) { clearInterval(timerInterval); }

    timerInterval = setInterval(() => {
        if (!isIdle) {
            totalSeconds++;

            // --- PURE JAVASCRIPT EXTENSION EXTRACTION (No imports needed) ---
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document) {
                const fileName = activeEditor.document.fileName;
                
                // Check if the file has an extension dot
                if (fileName.includes('.')) {
                    const ext = fileName.split('.').pop()?.toLowerCase().trim();
                    if (ext) {
                        fileTypeStats[ext] = (fileTypeStats[ext] || 0) + 1;
                    }
                } else {
                    fileTypeStats['no-ext'] = (fileTypeStats['no-ext'] || 0) + 1;
                }
            } else {
                fileTypeStats['empty/idle'] = (fileTypeStats['empty/idle'] || 0) + 1;
            }
        }
        
        if (currentProvider) {
            currentProvider.updateUI(totalSeconds, isIdle, fileTypeStats);
        }
    }, 1000);
}

function onUserActivity() {
    if (isIdle) {
        isIdle = false;
        if (currentProvider) {
            currentProvider.updateUI(totalSeconds, isIdle, fileTypeStats);
        }
    }
    resetIdleTimer();
}

function resetIdleTimer() {
    if (idleTimeout) { clearTimeout(idleTimeout); }
    idleTimeout = setTimeout(() => {
        isIdle = true;
        if (currentProvider) {
            currentProvider.updateUI(totalSeconds, isIdle, fileTypeStats);
        }
    }, IDLE_THRESHOLD_SECONDS * 1000);
}

// --- WEBVIEW VIEW PROVIDER ---
class TimeTrackerViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtmlForWebview();
        
        this.updateUI(totalSeconds, isIdle, fileTypeStats);
    }

    public updateUI(seconds: number, idleState: boolean, stats: { [key: string]: number }) {
        if (!this._view) { return; }

        const formatted = this._formatTime(seconds);
        
        // Build the visual roster payload
        const breakdownArray = Object.keys(stats).map(ext => {
            return {
                extension: ext.toUpperCase(),
                timeStr: this._formatTime(stats[ext])
            };
        });
        
        this._view.webview.postMessage({ 
            type: 'updateState', 
            time: formatted,
            isIdle: idleState,
            stats: breakdownArray
        });
    }

    private _formatTime(totalSecs: number): string {
        const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
        const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
        const secs = (totalSecs % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    private _getHtmlForWebview(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        padding: 15px;
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .clock-container {
                        font-size: 2rem;
                        font-weight: bold;
                        font-family: monospace;
                        margin-top: 15px;
                        padding: 10px 20px;
                        border-radius: 6px;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-widget-border);
                        transition: opacity 0.3s ease;
                    }
                    .clock-container.idle { opacity: 0.4; }
                    .status-badge {
                        margin-top: 10px;
                        font-size: 0.8rem;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        padding: 2px 8px;
                        border-radius: 4px;
                        margin-bottom: 25px;
                    }
                    .status-badge.active { background: #28a745; color: white; }
                    .status-badge.idle { background: #dc3545; color: white; }

                    .stats-container {
                        width: 100%;
                        max-width: 240px;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .stat-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 6px 10px;
                        border-radius: 4px;
                        background: var(--vscode-sideBar-background);
                        border: 1px solid var(--vscode-widget-border);
                        font-size: 0.9rem;
                    }
                    .extension-label {
                        font-weight: bold;
                        color: var(--vscode-textLink-foreground);
                    }

                    .mascot-placeholder {
                        margin-top: 40px;
                        font-style: italic;
                        opacity: 0.5;
                        font-size: 0.9rem;
                    }
                </style>
            </head>
            <body>
                <h3>Session Time</h3>
                <div class="clock-container" id="clock">00:00:00</div>
                <div class="status-badge active" id="status">Active</div>
                
                <h4>Languages Breakdown</h4>
                <div class="stats-container" id="statsList">
                    <div style="text-align: center; opacity: 0.5;">No active file metrics yet.</div>
                </div>

                <div class="mascot-placeholder">(Mascot placeholder room 🐾)</div>

                <script>
                    const clockEl = document.getElementById('clock');
                    const statusEl = document.getElementById('status');
                    const statsListEl = document.getElementById('statsList');

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'updateState') {
                            clockEl.textContent = message.time;
                            
                            if (message.isIdle) {
                                clockEl.classList.add('idle');
                                statusEl.textContent = 'Idle (Paused)';
                                statusEl.className = 'status-badge idle';
                            } else {
                                clockEl.classList.remove('idle');
                                statusEl.textContent = 'Active';
                                statusEl.className = 'status-badge active';
                            }

                            if (message.stats && message.stats.length > 0) {
                                statsListEl.innerHTML = ''; 
                                message.stats.forEach(item => {
                                    const row = document.createElement('div');
                                    row.className = 'stat-row';
                                    row.innerHTML = \`
                                        <span class="extension-label">\${item.extension}</span>
                                        <span>\${item.timeStr}</span>
                                    \`;
                                    statsListEl.appendChild(row);
                                });
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}

export function deactivate() {
    if (timerInterval) { clearInterval(timerInterval); }
    if (idleTimeout) { clearTimeout(idleTimeout); }
}
