import { join } from 'path';

export let __static: string;
if (import.meta.env.DEV) {
    __static = join(__dirname, '../../static').replace(/\\/g, '\\\\');
} else {
    __static = join(__dirname, '../../../static').replace(/\\/g, '\\\\');
}
