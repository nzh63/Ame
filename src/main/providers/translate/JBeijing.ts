import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { defineTranslateProvider } from '@main/providers/translate';
import { __static } from '@main/paths';

export default defineTranslateProvider({
    id: 'JBeijing',
    description: '你先翻译器，你可以在 https://www.kodensha.jp/index/products/jb/ 购买\n只支持日译中',
    optionsSchema: {
        enable: Boolean,
        path: {
            dll: [String, null],
            userDicts: String
        }
    } as const,
    defaultOptions: {
        enable: true,
        path: {
            dll: null,
            userDicts: ''
        }
    },
    optionsDescription: {
        enable: '启用',
        path: {
            dll: 'JBJCT.dll 的路径',
            userDicts: '用户辞书路径，以半角分号（;）分隔'
        }
    },
    data() {
        return {
            process: null as ChildProcess | null,
            queue: Promise.resolve() as Promise<any>
        };
    }
}, {
    init() {
        if (!this.options.enable || !this.options.path.dll) return;
        this.data.process = spawn(path.join(__static, 'native/bin/JBeijingCli.exe'), [
            this.options.path.dll,
            ...this.options.path.userDicts.split(';'), '', '', ''
        ], { stdio: 'pipe' });
    },
    isReady() { return this.options.enable && !!this.options.path.dll && !!this.data.process && this.data.process.exitCode === null; },
    async translate(t) {
        if (!this.data.process) throw new Error('cli process not init');
        const promise = this.data.queue.then(() => new Promise<string>(resolve => {
            const input = Buffer.from(t, 'ucs2');
            const inputSize = Buffer.alloc(2);
            inputSize.writeUInt16LE(input.length);
            this.data.process?.stdin?.write(inputSize);
            this.data.process?.stdin?.write(input);
            let output = Buffer.alloc(0);
            let outputSize = Buffer.alloc(0);
            const callback = (_c: any) => {
                let c = Buffer.from(_c);
                if (outputSize.length < 2) {
                    outputSize = outputSize.length ? Buffer.concat([outputSize, c.slice(0, 2 - outputSize.length)]) : c.slice(0, 2 - outputSize.length);
                    c = c.slice(outputSize.length);
                }
                if (c.length) {
                    output = output.length ? Buffer.concat([output, c]) : c;
                    if (output.length >= outputSize.readUInt16LE()) {
                        resolve(output.toString('ucs2'));
                        this.data.process?.stdout?.off('data', callback);
                    }
                }
            };
            this.data.process?.stdout?.on('data', callback);
        }));
        this.data.queue = promise;
        return promise;
    },
    destroy() {
        this.data.process?.stdin?.write(Buffer.alloc(2, 0));
        setTimeout(() => {
            if (this.data.process && this.data.process.exitCode === null) this.data.process.kill();
        }, 500);
    }
});
