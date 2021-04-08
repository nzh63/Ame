import { app, dialog } from 'electron';
import { exec } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';

const execPromisify = promisify(exec);

let powershellPath = '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"';
let powershellReadyResolve: (value: void | PromiseLike<void>) => void;
const powershellReady = new Promise<void>(resolve => {
    powershellReadyResolve = resolve;
});
fs.stat(powershellPath, async (err) => {
    if (err) powershellPath = 'powershell.exe';
    try {
        await execPromisify(`${powershellPath} /?`);
    } catch (e) {
        dialog.showErrorBox('环境出错', `无法运行Powershell\n${e.message ?? e}`);
        app.exit(1);
    }
    powershellReadyResolve();
});

export async function execPowerShell(command: string) {
    await powershellReady;
    return await execPromisify(`${command}`, { shell: powershellPath });
}
