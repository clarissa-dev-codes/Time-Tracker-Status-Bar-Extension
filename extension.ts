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
const IDLE_THRESHOLD_SECONDS = 15; 

//daily milestone variables
//reminder to change it to 7200 *about two hours
let dailyGoalSeconds = 2 * 60 * 60; //is in seconds because of course it is
let isGoalCelebrated = false;

// Storage dictionary for time spent per file type
let fileTypeStats: { [key: string]: number } = {};

// Mascot Customization & Break Reminder Variables
let mascotHueRotation = 0;
const BREAK_ALERT_THRESHOLD_SECONDS = 3600; //that's an hour for hour long coding sessionns
let continuousCodingSeconds = 0;
let isAngryMascotBreakActive = false;

export function activate(context: vscode.ExtensionContext) {
    console.log('Time Tracker Sidebar Extension with Safe File Tracking is activating...');

    const provider = new TimeTrackerViewProvider(context, context.extensionUri);
    currentProvider = provider;

	//Resolve Project Workspace Boundary Anchor
	const currentWorkspaceFolders = vscode.workspace.workspaceFolders;
	const currentWorkspaceKey = currentWorkspaceFolders ? currentWorkspaceFolders[0].uri.fsPath : 'empty-workspace';
	const savedWorkspaceKey = context.globalState.get<string>('lastWorkspaceKey', '');

	//Resolve Calendar Date Boundary Anchor (YYY-MM-DD format)
	const currentDateKey = new Date().toISOString().split('T')[0];
	const savedDateKey = context.globalState.get<string>('lastDateKey', '');

	//Automatic reset eval check
	if (savedWorkspaceKey !== currentWorkspaceKey || savedDateKey !== currentDateKey){
		//boundary line was crossed and stats are reset to zero
		totalSeconds = 0;
		fileTypeStats = {};
		isGoalCelebrated = false;
		continuousCodingSeconds = 0;
		isAngryMascotBreakActive = false;

		const savedGoalHours = context.globalState.get<number>('savedGoalHours', 2.0);
		dailyGoalSeconds = savedGoalHours * 60 * 60;

		mascotHueRotation = context.globalState.get<number>('savedMascotHue', 0);

		//update persistent disk trackers to match new current state anchors
		context.globalState.update('savedTotalSeconds', totalSeconds);
		context.globalState.update('savedFileTypeStats', fileTypeStats);
		context.globalState.update('lastWorkspaceKey', currentWorkspaceKey);
		context.globalState.update('lastDateKey', currentDateKey);

		vscode.window.showInformationMessage('Ducky detected a new project or a brand new day! Stats fresh and reset to zero.');
	}
	else{
		//user is still wrorking on the exact same project on the same day, loading in cache instead
		totalSeconds = context.globalState.get<number>('savedTotalSeconds', 0);
		fileTypeStats = context.globalState.get<{ [key: string]: number }>('savedFileTypeStats', {});
		isGoalCelebrated = context.globalState.get<boolean>('isGoalCelebrated', false);

		const savedGoalHours = context.globalState.get<number>('savedGoalHours', 2.0);
		dailyGoalSeconds = savedGoalHours * 60 * 60;

		mascotHueRotation = context.globalState.get<number>('savedMascotHue', 0);
	}

	// --- Load save data --- //
	totalSeconds = context.globalState.get<number>('savedTotalSeconds', 0);
	fileTypeStats = context.globalState.get<{ [key: string]: number}>('savedFileTypeStats', {});

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('time-tracker-sidebar-view', provider)
    );

    startTimer(context);
    resetIdleTimer();

    // --- ACTIVITY LISTENERS ---
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => onUserActivity()));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => onUserActivity()));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => onUserActivity()));
}

function startTimer(context: vscode.ExtensionContext) {
    if (timerInterval) { clearInterval(timerInterval); }

    timerInterval = setInterval(() => {
        if (!isIdle) {
            totalSeconds++;

			continuousCodingSeconds++;

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

			// -- Milestone Target Check -- //
			if(totalSeconds >= dailyGoalSeconds && !isGoalCelebrated)
			{
				isGoalCelebrated = true;
				context.globalState.update('isGoalCelebrated', true);
				vscode.window.showInformationMessage('Milestone Achieved! You hit your daily coding goal! Ducky is proud of you!');
			}

			// --- Hourly Break Trigger Check Engine --- //
			if(continuousCodingSeconds >= BREAK_ALERT_THRESHOLD_SECONDS && !isAngryMascotBreakActive){
				isAngryMascotBreakActive = true;
				vscode.window.showErrorMessage('Ducky Alert: You\'ve been coding for an hour straight! Get up, stretch, and give your eyes a break!');
			}

			context.globalState.update('savedTotalSeconds', totalSeconds);
			context.globalState.update('savedFileTypeStats', fileTypeStats);
        }
		else{
			if(isAngryMascotBreakActive){
				isAngryMascotBreakActive = false;
				vscode.window.showInformationMessage('Thank you for taking a break! Ducky is happy now.');
			}
			continuousCodingSeconds = 0;
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
    private readonly _extensionUri: vscode.Uri;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        extensionUri: vscode.Uri
    ) {
        this._extensionUri = extensionUri;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = { 
			enableScripts: true,
			localResourceRoots:[
				this._extensionUri,
				vscode.Uri.joinPath(this._extensionUri, 'media')
			]
		};

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
		//Listens for messages coming from the webview
		webviewView.webview.onDidReceiveMessage(message => {
			switch(message.command){
				case 'startPomodoro':
					startPomodoroMode();
					break;

				case 'resetAllStats':
					totalSeconds = 0;
					fileTypeStats = {};

					this._context.globalState.update('savedTotalSeconds', 0);
					this._context.globalState.update('savedFileTypeStats', {});
					this._context.globalState.update('isGoalCelebrated', false);

					this.updateUI(totalSeconds, isIdle, fileTypeStats);

					vscode.window.showInformationMessage('Ducky session counters reset manually!');
					break;

				case 'updateDailyGoal':
					const inputHours = message.value;
					dailyGoalSeconds = inputHours * 60 * 60;

					if(totalSeconds < dailyGoalSeconds)
					{
						isGoalCelebrated = false;
						this._context.globalState.update('isGoalCelebrated', false);

						this._context.globalState.update('savedGoalHours', inputHours);
						this.updateUI(totalSeconds, isIdle, fileTypeStats);

						vscode.window.showInformationMessage(`Daily goal updated to ${inputHours} hours!`);
						break;
					}

				case 'openDashboard':
					openHistoryDashboard(this._context);
					break;

				case 'updateMascotHue':
					const newHue = message.value;
					mascotHueRotation = newHue;
					this._context.globalState.update('savedMascotHue', newHue);
					this.updateUI(totalSeconds, isIdle, fileTypeStats);
					break;

				case 'updateMascotCostume':
					const selectedOutfit = message.value;
					this._context.globalState.update('savedCostume', selectedOutfit);
					this.updateUI(totalSeconds, isIdle, fileTypeStats);
					break;

			}
		});

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

		const currentSavedHours = this._context.globalState.get<number>('savedGoalHours', 2.0);

		const savedCostume = this._context.globalState.get<string>('savedCostume', '');
        
        this._view.webview.postMessage({ 
            type: 'updateState', 
            time: formatted,
            isIdle: idleState,
            stats: breakdownArray,
			isPomoActive: isPomodoroActive,
			pomoTime: formattedPomodoro,
			isGoalReached: isGoalCelebrated,
			currentGoalHours: currentSavedHours,
			savedHue: mascotHueRotation,
			isUserIgnoringBreak: isAngryMascotBreakActive,

			currentCostume: savedCostume
        });
    }

    private _formatTime(totalSecs: number): string {
        const hrs = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
        const mins = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
        const secs = (totalSecs % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

	private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
	}

    private _getHtmlForWebview(webview: vscode.Webview): string {
		const activeMascotUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'DuckyMain.png'));
		const idleMascotUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'DuckyIdle.png'));
		const angryMascotUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'DuckyAngry.png'));

		const bowtieOutfitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'Bowtie.png'));
		const bowOutfitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'Bow.png'));
		const breadOutfitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'Bread.png'));
		const flowerOutfitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'Flower.png'));
		const axolotlOutfitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'AxolotlMask.png'));

		let htmlFilePath = vscode.Uri.joinPath(this._extensionUri, 'src', 'sidebar.html');
		if (!fs.existsSync(htmlFilePath.fsPath)){
			htmlFilePath = vscode.Uri.joinPath(this._extensionUri, 'sidebar.html');
		}

		const nonce = this._getNonce();
		
		try {
			const rawBuffer = require('fs').readFileSync(htmlFilePath.fsPath);
			let htmlContent = rawBuffer.toString('utf8');

            htmlContent = htmlContent.replace(/\${cspSource}/g, webview.cspSource);
            htmlContent = htmlContent.replace(/\${nonce}/g, nonce);

            htmlContent = htmlContent.replace(/\${activeMascotUri}/g, activeMascotUri.toString());
            htmlContent = htmlContent.replace(/\${idleMascotUri}/g, idleMascotUri.toString());
            htmlContent = htmlContent.replace(/\${angryMascotUri}/g, angryMascotUri.toString());

            htmlContent = htmlContent.replace(/\${bowtieOutfitUri}/g, bowtieOutfitUri.toString());
			htmlContent = htmlContent.replace(/\${bowOutfitUri}/g, bowOutfitUri.toString());
			htmlContent = htmlContent.replace(/\${breadOutfitUri}/g, breadOutfitUri.toString());
			htmlContent = htmlContent.replace(/\${flowerOutfitUri}/g, flowerOutfitUri.toString());
			htmlContent = htmlContent.replace(/\${axolotlOutfitUri}/g, axolotlOutfitUri.toString());

            return htmlContent;
        } catch (error) {
            console.error("Critical Sidebar Read Error:", error);
            return `<html><body><h3>Failed loading layout from extension root structure.</h3></body></html>`;
        }
    
	}

}

function openHistoryDashboard(context: vscode.ExtensionContext){
	const panel = vscode.window.createWebviewPanel(
		'duckyHistoryDashboard',
		'Ducky Analytics Dashboard',
		vscode.ViewColumn.One,
		{
			enableScripts: true 
		}
	);

	let statsRowsHtml = '';
	const totalHrs = (totalSeconds / 3600).toFixed(2);

	if(Object.keys(fileTypeStats).length === 0){
		statsRowsHtml = `<p style="opacity: 0.5; text-align: center;">No file historical summaries logged yet.</p>`;
	}
	else{
		Object.keys(fileTypeStats).forEach(ext => {
			const secs = fileTypeStats[ext];
			const mins = Math.floor(secs/60);
			statsRowsHtml += `
				<div style="dislay: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--vscode-widget-border);">
				<span>${mins} minutes (${secs} seconds)</span>
			`;
		});
	}

	panel.webview.html = `
		<!DOCTYPE html>
		<html lan="en">
		<head>
			<meta charset="UTF-8">
			<style>
				body{
					padding: 30px;
					font-family: var(--vscode-font-family);
					color: var(--vscode-foreground);
					background: var(--vscode-editor-background);
				}
				.card {
					background: var(--vscode-sideBar-background);
					border: 1px solid var(--vscode-widget-border);
					padding: 20px;
					border-radius: 8px;
					max-width: 600px;
					margin: 0 auto 20px auto;
					box-shadow: 0 4px 10px rgba(0,0,0,0.1);
				}
				.header-title{
					text-align: center;
					color: var(--vscode-textLink-activeForeground);
					margin-bottom: 30px;
				}
				.metric-bubble{
					font-size: 3rem;
					font-weight: bold;
					text-align: center;
					margin: 20px 0;
					font-family: monospace;
				}
			</style>
		</head>
		<body>
			<h1 class="header-title">Ducky Workspace Productivity Report</h1>

			<div class="card>
				<h2>Total Active Coding Investment</h2>
				<p>This metrics engine captures all recorded non-idle session intervals on the current calendar day tracking loop.</p>
				<div class="metric-bubble">${totalHrs} hrs</div>
				<p style="text-align: center; opacity: 0.7;">Total accumulated seconds: <strong>${totalSeconds}s</strong></p>
			</div>

			<div class="card>
				<h2>Language Metrics Distribution</h2>
				<div style="display: flex; flex-direction: column; gap: 4px;">
					${statsRowsHtml}
				</div>
			</div>
		</body>
		</html>
	`;
}

export function deactivate() {
    if (timerInterval) { clearInterval(timerInterval); }
    if (idleTimeout) { clearTimeout(idleTimeout); }
}
