import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EOL } from 'os';
import { join } from 'path';
import { isWow64 } from '@main/win32';
import { __static } from '@main/paths';
import { BaseExtractor } from '@main/extractor/BaseExtractor';
import logger from '@logger/extractor/textractor';

export interface PostProcessOption {
    removeDuplication?: boolean;
}

export declare interface Textractor extends BaseExtractor {
    on(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    on<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    on(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;

    once(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    once<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    once(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;

    off(event: 'update:any', listener: (t: Ame.Translator.OriginalText) => void): this;
    off<T extends Ame.Extractor.Key>(event: `update:${T}`, listener: (t: Ame.Translator.OriginalText) => void): this;
    off(event: 'textractor-cli-exit', listener: (code: number | null) => void): this;
}

export class Textractor extends BaseExtractor {
    static readonly TextractorCliX64 = join(__static, './lib/x64/TextractorCLI.exe');
    static readonly TextractorCliX86 = join(__static, './lib/x86/TextractorCLI.exe');
    private textractorCliProcess: ChildProcessWithoutNullStreams;
    private textractorCliStdoutBuffer = '';

    public postProcessOption: PostProcessOption = {
        removeDuplication: false
    };

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
        return isWow64(this.gamePids[0]);
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
            const result = this.textractorCliStdoutBuffer.split(/\r?\n(?=\[|$)/);
            while (result.length > 1) {
                const line = '' + result.shift();
                const [, key, text] = /^\[(.*?)\] ([\S\s]*)$/.exec(line) ?? [null, null, null];
                if (key && text) {
                    this.onUpdate(key, this.postProcess(text));
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

    private postProcess(text: string) {
        if (this.postProcessOption.removeDuplication) {
            return text.replace(/(.)\1{1,6}/g, i => i[0]);
        } else {
            return text;
        }
    }

    public pause() { }
    public resume() { }

    public destroy() {
        logger('destroy, pids %O', this.gamePids);
        this.stopHook();
    }
}
