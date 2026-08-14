// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


let totalSeconds = 0;
let timerInterval: NodeJS.Timeout | undefined;
let currentProvider: TimeTrackerViewProvider | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "time-tracker-status-bar" is now active!');

	//creates provider
	const provider = new TimeTrackerViewProvider(context.extensionUri);
	currentProvider = provider;

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('time-tracker-sidebar-view', provider)
	);
	

	startTimer();

	
}

//timer function
function startTimer()
{
	if(timerInterval)
	{
		clearInterval(timerInterval);
	}

	timerInterval = setInterval(() => {
		totalSeconds++;
		if(currentProvider)
		{
			currentProvider.updateTimeDisplay(totalSeconds);
		}
	}, 1000);
}

class TimeTrackerViewProvider implements vscode.WebviewViewProvider{
	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri)	{}

	public resolveWebviewView(
		webviewView: vscode.WebviewView, 
		context: vscode.WebviewViewResolveContext, 
		token: vscode.CancellationToken) {
			this._view = webviewView;

			webviewView.webview.options = {enableScripts: true};

			webviewView.webview.html = this._getHtmlForWebview();
		}

		public updateTimeDisplay(seconds: number)
		{
			if(!this._view)
			{
				return;
			}
			const formatted = this._formatTime(seconds);
			this._view.webview.postMessage({type: 'updateTime', value: formatted});
		}

		private _formatTime(totalSecs: number): string {
			const hrs = Math.floor(totalSecs / 3600).toString().padStart(2,'0');
			const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
			const secs = (totalSecs % 60).toString().padStart(2, '0');
			return `${hrs}:${mins}:${secs}`;
		}

		private _getHtmlForWebview(): string{
			return `<!DOCTYPE html>
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
                        justify-content: center;
                    }
                    .clock-container {
                        font-size: 2rem;
                        font-weight: bold;
                        font-family: monospace;
                        margin-top: 20px;
                        padding: 10px 20px;
                        border-radius: 6px;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-widget-border);
                    }
                    .mascot-placeholder {
                        margin-top: 30px;
                        font-style: italic;
                        opacity: 0.5;
                        font-size: 0.9rem;
                    }
                </style>
            </head>
            <body>
                <h3>Session Time</h3>
                <div class="clock-container" id="clock">00:00:00</div>
                
                <!-- Future mascot area -->
                <div class="mascot-placeholder">(Mascot placeholder room 🐾)</div>

                <script>
                    const clockEl = document.getElementById('clock');
                    // Listen for message events coming down from extension.ts
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'updateTime') {
                            clockEl.textContent = message.value;
                        }
                    });
                </script>
            </body>
            </html>
			`;
		
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	if(timerInterval)
	{
		clearInterval(timerInterval);
	}
}
