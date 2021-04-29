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
        translateType: {
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
        translateType: '日->中'
    },
    optionsDescription: {
        enable: '启用',
        path: {
            dllTransCOM: { readableName: 'TransCOM.dll 的路径', description: '可在"安装目录/DreyeMT/SDK/bin"下找到' },
            dllTransCOMEC: { readableName: 'TransCOMEC.dll 的路径', description: '可在"安装目录/DreyeMT/SDK/bin"下找到' }
        },
        translateType: '翻译选项'
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
        if (this.translateType === '日->中') {
            dll = this.path.dllTransCOM;
            suffix = 'CJ';
            dat = DAT.JC;
            this.enc.src = ENC.JA;
            this.enc.dest = ENC.ZH;
        } else if (this.translateType === '中->日') {
            dll = this.path.dllTransCOM;
            suffix = 'CJ';
            dat = DAT.JC;
            this.enc.src = ENC.ZH;
            this.enc.dest = ENC.JA;
        } else if (this.translateType === '英->中') {
            dll = this.path.dllTransCOMEC;
            suffix = 'EC';
            dat = DAT.EC;
            this.enc.src = ENC.EN;
            this.enc.dest = ENC.ZH;
        } else if (this.translateType === '中->英') {
            dll = this.path.dllTransCOMEC;
            suffix = 'EC';
            dat = DAT.EC;
            this.enc.src = ENC.ZH;
            this.enc.dest = ENC.EN;
        } else {
            // eslint-disable-next-line  @typescript-eslint/no-unused-vars
            const _typeCheck: never = this.translateType;
        }
        if (!this.enable || !dll) return;
        try {
            await fs.promises.stat(dll);
        } catch (e) {
            return;
        }
        this.process = spawn(path.join(__static, 'native/bin/DrEyeCli.exe'), [
            dll,
            'MTInit' + suffix,
            'MTEnd' + suffix,
            'TranTextFlow' + suffix,
            '' + dat
        ], { stdio: 'pipe', cwd: path.dirname(dll) });
    },
    isReady() {
        return this.enable && (
            (this.translateType === '日->中' && this.path.dllTransCOM !== null) ||
            (this.translateType === '中->日' && this.path.dllTransCOM !== null) ||
            (this.translateType === '英->中' && this.path.dllTransCOMEC !== null) ||
            (this.translateType === '中->英' && this.path.dllTransCOMEC !== null)
        ) && !!this.process && this.process.exitCode === null;
    },
    async translate(t) {
        if (!this.process) throw new Error('cli process not init');
        const promise = this.queue.then(() => new Promise<string>(resolve => {
            const input = encode(t, this.enc.src);
            const inputSize = Buffer.alloc(2);
            inputSize.writeUInt16LE(input.length);
            this.process?.stdin?.write(inputSize);
            this.process?.stdin?.write(input);
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
                resolve(decode(output, this.enc.dest));
                this.process?.stdout?.off('data', callback);
            };
            const timeoutId = setTimeout(finish, 1000);
            this.process?.stdout?.on('data', callback);
        }));
        this.queue = promise;
        return promise;
    },
    destroy() {
        this.process?.stdin?.write(Buffer.alloc(2, 0));
        setTimeout(() => {
            if (this.process && this.process.exitCode === null) this.process.kill();
        }, 500);
    }
});
