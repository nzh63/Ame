import { parse } from 'path';
import { promisify } from 'util';
import { knl32, execPowerShell } from '@main/win32';

export async function findProcess(path: string) {
    const { stdout } = await execPowerShell(`Get-Process | where ProcessName -eq '${parse(path).name}' | where Path -eq '${path}' | sort StartTime | select id`);
    return stdout
        .split('\n')
        .map(i => i.trim())
        .filter(i => /\d+/.test(i))
        .map(i => parseInt(i));
}

export async function waitProcessForExit(pids: number[]) {
    const WaitForSingleObject = promisify(knl32.WaitForSingleObject.async);
    const handles = pids.map(pid => knl32.OpenProcess(0x00100000 /* SYNCHRONIZE */, 0, pid));
    for (const handle of handles) {
        if (handle === 0) {
            // process may have exited.
            continue;
        }
        let ret = 0;
        do {
            ret = 0;
            try {
                ret = await WaitForSingleObject(handle, 10);
            } catch (e) { }
        } while (ret === 0x00000102 /* WAIT_TIMEOUT */);
    }
}
