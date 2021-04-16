import type { Extractor } from '@main/extractor';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import EventEmitter from 'events';
import { EOL } from 'os';
import { join } from 'path';
import { knl32, nt } from '@main/win32';
import { __static } from '@main/paths';
import logger from '@logger/extractor/textractor';

export declare interface Textractor extends Extractor {
    on(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    on<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    on(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    once(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    once<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    once(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;

    off(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    off<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    off(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
}

export class Textractor extends EventEmitter implements Extractor {
    static readonly TextractorCliX64 = join(__static, './lib/x64/TextractorCLI.exe');
    static readonly TextractorCliX86 = join(__static, './lib/x86/TextractorCLI.exe');
    private textractorCliProcess: ChildProcessWithoutNullStreams;
    private text_: Ame.Extractor.Result = {};
    private textractorCliStdoutBuffer = '';
    constructor(
        public gamePids: number[],
        public hookCode = ''

    ) {
        super();
        logger('start hook for pids %O', this.gamePids);
        this.textractorCliProcess = this.startProcess();
        this.startHook();
    }

    private get isWow64() {
        const handle = knl32.OpenProcess(0x0400/* PROCESS_QUERY_INFORMATION  */, 0, this.gamePids[0]);
        const buf = Buffer.from(new Uint8Array({ length: 8 }));
        const returnLength = Buffer.from(new Uint8Array({ length: 8 }));
        nt.NtQueryInformationProcess(handle, 26/* ProcessWow64Information */, buf, 8, returnLength);
        return buf.readBigInt64LE(0) !== 0n;
    }

    private get textractorCliPath() {
        return this.isWow64 ? Textractor.TextractorCliX86 : Textractor.TextractorCliX64;
    }

    private execCommand(command: string) {
        logger('exec TextractorCli command: %s', command);
        this.textractorCliProcess.stdin.write(command + EOL);
    }

    private startProcess() {
        const process = spawn(this.textractorCliPath);
        process.stdin.setDefaultEncoding('utf16le');
        process.stdout.setEncoding('utf16le');
        process.on('exit', code => this.emit('textractor-cli-exit', code));
        logger('started TextractorCli pid: %d', process.pid);
        return process;
    }

    private startHook() {
        logger('Textractor hook for pids %O', this.gamePids);
        this.gamePids.forEach(pid => this.execCommand(`attach ${this.hookCode} -P${pid}`));
        this.textractorCliProcess.stdout.on('data', data => {
            data = '' + data;
            this.textractorCliStdoutBuffer += data;
            const result = this.textractorCliStdoutBuffer.split('\n');
            while (result.length > 1) {
                const line = '' + result.shift();
                const [, key, text] = /\[(.*?)\](.*)/.exec(line) ?? [null, null, null];
                if (key && text) {
                    this.onUpdate(key, text);
                }
            }
            this.textractorCliStdoutBuffer = result[0];
        });
    }

    private stopHook() {
        logger('stop Textractor hook for pids %O', this.gamePids);
        // this.gamePids.forEach(pid => void this.execCommand(`detach -P${pid}`));
        this.textractorCliProcess.kill();
    }

    private onUpdate(key: string, text: string) {
        logger('Textractor update { %s: %s }', key, text);
        this.text_[key] = text;
        this.emit(`update:${key}`, { key, text });
        this.emit('update:any', { key, text });
    }

    public get text(): Readonly<Ame.Extractor.Result> {
        return this.text_;
    }

    public destroy() {
        logger('destroy, pids %O', this.gamePids);
        this.stopHook();
    }
}
