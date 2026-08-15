import * as vscode from 'vscode';
import * as fs from 'fs'; //uses Node's file system to read HTML file

let totalSeconds = 0;
let timerInterval: NodeJS.Timeout | undefined;
let idleTimeout: NodeJS.Timeout | undefined;
let currentProvider: TimeTrackerViewProvider | undefined;

// -- Pomodoro tracker variables --- //
let pomodoroSecondsLeft = 0;
let pomodoroInterval: NodeJS.Timeout | undefined;
let isPomodoroActive = false;

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

// -- Pomodoro function -- //
function startPomodoroMode(){
	if (isPomodoroActive){
		vscode.window.showWarningMessage('Ducky is already focused on a sprint!');
		return;
	}

	isPomodoroActive = true;
	pomodoroSecondsLeft = 25 * 60;

	vscode.window.showInformationMessage('Ducky Focus Mode Started! Let\'s crush this 25-minute sprint.');

	if(pomodoroInterval)
	{
		clearInterval(pomodoroInterval);
	}

	pomodoroInterval = setInterval(() => {
		//only countdown if the user isn't completely idle
		if (!isIdle && pomodoroSecondsLeft > 0){
			pomodoroSecondsLeft--;
		}

		//when the timer runs out
		if(pomodoroSecondsLeft <= 0){
			clearInterval(pomodoroInterval);
			isPomodoroActive = false;
			vscode.window.showInformationMessage('Sprint Complete! Time for a well-deserved break! Excellent work.', {modal: true});
		}

		//Push updates down to the UI panel
		if(currentProvider){
			currentProvider.updateUI(totalSeconds, isIdle, fileTypeStats);
		}
	}, 1000);
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
        webviewView.webview.options = { 
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
		};
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
		//Listens for messages coming from the webview
		webviewView.webview.onDidReceiveMessage(message => {
			switch(message.command){
				case 'startPomodoro':
					startPomodoroMode();
					break;
			}
		})

        this.updateUI(totalSeconds, isIdle, fileTypeStats);
    }

    public updateUI(seconds: number, idleState: boolean, stats: { [key: string]: number }) {
        if (!this._view) { return; }

        const formatted = this._formatTime(seconds);

		// --- Pomodoro time as MM:SS --- //
		const pomoMins = Math.floor(pomodoroSecondsLeft/60).toString().padStart(2, '0');
		const pomoSecs = (pomodoroSecondsLeft % 60).toString().padStart(2, '0');
		const formattedPomodoro = `${pomoMins}:${pomoSecs}`;
        
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
            stats: breakdownArray,
			isPomoActive: isPomodoroActive,
			pomoTime: formattedPomodoro
        });
    }

    private _formatTime(totalSecs: number): string {
        const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
        const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
        const secs = (totalSecs % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
		const activeMascotUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'DuckyMain.png'));
		const idleMascotUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'DuckyIdle.png'));

		const htmlFilePath = vscode.Uri.joinPath(this._extensionUri, 'src', 'sidebar.html');
		let htmlContent = fs.readFileSync(htmlFilePath.fsPath, 'utf8');

		htmlContent = htmlContent.replace(/\${cspSource}/g, webview.cspSource);
		htmlContent = htmlContent.replace(/\${activeMascotUri}/g, activeMascotUri.toString());
		htmlContent = htmlContent.replace(/\${idleMascotUri}/g, idleMascotUri.toString());

		return htmlContent;
	}

}

export function deactivate() {
    if (timerInterval) { clearInterval(timerInterval); }
    if (idleTimeout) { clearTimeout(idleTimeout); }
}
