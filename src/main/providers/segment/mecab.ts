import { spawn } from 'child_process';
import { promises as fsPromises } from 'fs';
import { encode, decode } from 'iconv-lite';
import { defineSegmentProvider } from '@main/providers/segment';
import logger from '@logger/provider/segment/mecab';

export default defineSegmentProvider({
    id: 'mecab',
    optionsSchema: {
        enable: Boolean,
        exePath: String,
        encoding: {
            type: String,
            enum: ['Shift_JIS', 'UTF-8', 'UTF-16', 'EUC-JP']
        }
    } as const,
    defaultOptions: {
        enable: false,
        exePath: 'C:/Program Files (x86)/MeCab/bin/mecab.exe',
        encoding: 'Shift_JIS'
    },
    optionsDescription: {
        enable: '启用',
        exePath: 'mecab.exe路径',
        encoding: '编码格式'
    },
    data() {
        return {
            fileExist: false
        };
    }
}, {
    async init() {
        if (!this.enable) return;
        try {
            await fsPromises.stat(this.exePath);
            this.fileExist = true;
        } catch (e) {
        }
    },
    isReady() { return this.enable && this.fileExist; },
    async segment(text) {
        const exe = spawn(this.exePath, { stdio: 'pipe' });
        exe.stdin.end(encode(text, this.encoding));
        let output = '';
        exe.stdout.on('data', (data) => {
            output += decode(Buffer.from(data), this.encoding);
        });
        await new Promise(resolve => exe.stdout.once('close', resolve));
        logger(output);
        return output
            .split('\n')
            .flatMap(i => {
                const ret = /^(.+)\t/.exec(i)?.[1];
                return ret ? [ret] : [];
            });
    }
});
