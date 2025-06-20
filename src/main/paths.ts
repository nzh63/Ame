import { join } from 'path';

export let __static: string;
if (import.meta.env.DEV) {
  __static = join(__dirname, '../../build/static').replace(/\\/g, '/');
} else {
  __static = join(process.resourcesPath, 'static').replace(/\\/g, '/');
}

export const __assets = join(__dirname, '../../assets').replace(/\\/g, '/');
export let __workers: string;
if (import.meta.env.DEV) {
  __workers = join(__dirname, '../workers').replace(/\\/g, '/');
} else {
  __workers = join(process.resourcesPath, 'app.asar/build/workers').replace(/\\/g, '/');
}
