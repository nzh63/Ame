import { join } from 'path';

export let __static: string;
if (import.meta.env.DEV) {
    __static = join(__dirname, '../../static').replace(/\\/g, '\\\\');
} else {
    __static = join(__dirname, '../../../static').replace(/\\/g, '\\\\');
}

export const __assets = join(__dirname, '../../assets').replace(/\\/g, '\\\\');
export const __workers = join(__dirname, './workers').replace(/\\/g, '\\\\');
