import { parse } from 'path';
import { execPowerShell } from '@main/win32';
export { waitProcessForExit, isWow64 } from '@addons/Process';

export async function findProcess(path: string) {
    const { stdout } = await execPowerShell(`Get-Process | where ProcessName -eq '${parse(path).name.replace(/'/g, "''")}' | where Path -eq '${path.replace(/'/g, "''")}' | sort StartTime | select id`);
    return stdout
        .split('\n')
        .map(i => i.trim())
        .filter(i => /\d+/.test(i))
        .map(i => parseInt(i));
}
