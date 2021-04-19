import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { encode, decode } from 'iconv-lite';
import { defineTranslateProvider } from '@main/providers/translate';
import { __static } from '@main/paths';

enum DAT {
    EC = 1,
    CE = 2,
    CJ = 3,
    JC = 10,
}
enum ENC {
    JA = 'Shift_JIS',
    ZH = 'GBK',
    EN = 'utf-8',
}

export default defineTranslateProvider({
    id: 'DrEye',
    description: '离线翻译器，你可以在 https://www.dreye.com/ 购买',
    optionsSchema: {
        enable: Boolean,
        path: {
            dllTransCOM: [String, null],
            dllTransCOMEC: [String, null]
        },
        translate: {
            type: String,
            enum: ['日->中', '中->日', '英->中', '中->英']
        }
    } as const,
    defaultOptions: {
        enable: true,
        path: {
            dllTransCOM: null,
            dllTransCOMEC: null
        },
        translate: '日->中'
    },
    optionsDescription: {
        enable: '启用',
        path: {
            dllTransCOM: { readableName: 'TransCOM.dll 的路径', description: '可在 安装目录/DreyeMT/SDK/bin下找到' },
            dllTransCOMEC: { readableName: 'TransCOMEC.dll 的路径', description: '可在 安装目录/DreyeMT/SDK/bin下找到' }
        },
        translate: '翻译选项'
    },
    data() {
        return {
            process: null as ChildProcess | null,
            queue: Promise.resolve() as Promise<any>,
            enc: {
                src: ENC.JA,
                dest: ENC.ZH
            }
        };
    }
}, {
    async init() {
        let dll, suffix, dat;
        if (this.options.translate === '日->中') {
            dll = this.options.path.dllTransCOM;
            suffix = 'CJ';
            dat = DAT.JC;
            this.data.enc.src = ENC.JA;
            this.data.enc.dest = ENC.ZH;
        } else if (this.options.translate === '中->日') {
            dll = this.options.path.dllTransCOM;
            suffix = 'CJ';
            dat = DAT.JC;
            this.data.enc.src = ENC.ZH;
            this.data.enc.dest = ENC.JA;
        } else if (this.options.translate === '英->中') {
            dll = this.options.path.dllTransCOMEC;
            suffix = 'EC';
            dat = DAT.EC;
            this.data.enc.src = ENC.EN;
            this.data.enc.dest = ENC.ZH;
        } else if (this.options.translate === '中->英') {
            dll = this.options.path.dllTransCOMEC;
            suffix = 'EC';
            dat = DAT.EC;
            this.data.enc.src = ENC.ZH;
            this.data.enc.dest = ENC.EN;
        } else {
            // eslint-disable-next-line  @typescript-eslint/no-unused-vars
            const _typeCheck: never = this.options.translate;
        }
        if (!this.options.enable || !dll) return;
        try {
            await fs.promises.stat(dll);
        } catch (e) {
            return;
        }
        this.data.process = spawn(path.join(__static, 'native/bin/DrEyeCli.exe'), [
            dll,
            'MTInit' + suffix,
            'MTEnd' + suffix,
            'TranTextFlow' + suffix,
            '' + dat
        ], { stdio: 'pipe', cwd: path.dirname(dll) });
    },
    isReady() {
        return this.options.enable && (
            (this.options.translate === '日->中' && this.options.path.dllTransCOM !== null) ||
            (this.options.translate === '中->日' && this.options.path.dllTransCOM !== null) ||
            (this.options.translate === '英->中' && this.options.path.dllTransCOMEC !== null) ||
            (this.options.translate === '中->英' && this.options.path.dllTransCOMEC !== null)
        ) && !!this.data.process && this.data.process.exitCode === null;
    },
    async translate(t) {
        if (!this.data.process) throw new Error('cli process not init');
        const promise = this.data.queue.then(() => new Promise<string>(resolve => {
            const input = encode(t, this.data.enc.src);
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
                        finish();
                    }
                }
            };
            const finish = () => {
                clearTimeout(timeoutId);
                resolve(decode(output, this.data.enc.dest));
                this.data.process?.stdout?.off('data', callback);
            }
            const timeoutId = setTimeout(finish, 1000);
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
