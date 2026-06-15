const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Activates the VS Code extension commands.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Command: Save active selection as a snippet
  let addSelection = vscode.commands.registerCommand('snip.addSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const selection = editor.document.getText(editor.selection);
    if (!selection || !selection.trim()) {
      vscode.window.showWarningMessage('Snip: No selection to save.');
      return;
    }

    const name = await vscode.window.showInputBox({ 
      prompt: 'Enter snippet name',
      placeHolder: 'deploy-service'
    });
    if (!name || !name.trim()) return;

    const lang = await vscode.window.showInputBox({ 
      prompt: 'Language (sh, python, js, etc.)', 
      value: editor.document.languageId 
    });

    // Write selected content to a temp file to pipe it safely into the CLI
    const tempFile = path.join(os.tmpdir(), `vscode-snip-${Date.now()}`);
    try {
      fs.writeFileSync(tempFile, selection, 'utf8');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create temp file: ${err.message}`);
      return;
    }

    const sanitizedName = name.replace(/"/g, '\\"');
    const sanitizedLang = (lang || '').replace(/"/g, '\\"');
    const cmd = `snip add "${sanitizedName}" --lang "${sanitizedLang}" < "${tempFile}"`;

    exec(cmd, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (_) {}
      if (err) {
        vscode.window.showErrorMessage(`Snip failed to add snippet: ${stderr || err.message}`);
        return;
      }
      vscode.window.showInformationMessage(`Snip: Added snippet "${name}" successfully.`);
    });
  });

  // Command: List and run a snippet in the terminal
  let runSnippet = vscode.commands.registerCommand('snip.runSnippet', () => {
    exec('snip list --json', (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(`Snip list error: ${stderr || err.message}`);
        return;
      }
      
      try {
        const snippets = JSON.parse(stdout);
        if (!snippets || snippets.length === 0) {
          vscode.window.showInformationMessage('Snip: No snippets found.');
          return;
        }

        const items = snippets.map(s => ({
          label: s.name,
          description: s.language || 'text',
          detail: s.tags && s.tags.length > 0 ? s.tags.join(', ') : undefined
        }));

        vscode.window.showQuickPick(items, {
          placeHolder: 'Select snippet to run'
        }).then(selection => {
          if (!selection) return;

          // Open custom terminal and run snippet
          const terminal = vscode.window.createTerminal(`Snip: ${selection.label}`);
          terminal.show();
          terminal.sendText(`snip run "${selection.label}"`);
        });
      } catch (parseErr) {
        vscode.window.showErrorMessage(`Failed to parse snippets: ${parseErr.message}`);
      }
    });
  });

  context.subscriptions.push(addSelection, runSnippet);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
