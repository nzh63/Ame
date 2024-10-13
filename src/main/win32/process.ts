import { getPidFromPoint } from '@addons/Process';
import { execPowerShell } from '@main/win32';
import { parse } from 'path';

export { isWow64, waitProcessForExit } from '@addons/Process';

export function findProcess(path: string): Promise<number[]>;
export function findProcess(x: number, y: number): Promise<number[]>;
export function findProcess(v1: any, v2: any = undefined) {
  if (v2 === undefined) {
    return findProcessFromPath(v1);
  } else {
    return findProcessFromPoint(v1, v2);
  }
}

async function findProcessFromPath(path: string) {
  const { stdout } = await execPowerShell(
    `Get-Process | where ProcessName -eq '${parse(path).name.replace(/'/g, "''")}' | where Path -eq '${path.replace(/'/g, "''")}' | select id`,
  );
  return stdout
    .split('\n')
    .map((i) => i.trim())
    .filter((i) => /\d+/.test(i))
    .map((i) => parseInt(i, 10));
}

async function findProcessFromPoint(x: number, y: number) {
  const pid = getPidFromPoint(x, y);
  if (pid !== undefined) {
    return [pid];
  } else {
    return [];
  }
}
