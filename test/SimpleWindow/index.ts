/* eslint-disable @typescript-eslint/no-non-null-assertion */
import EventEmitter from 'events';
import dgram from 'dgram';
import path from 'path';
import { execPowerShell, findProcess } from '@main/win32';

const electronPath = path.join(process.cwd(), './node_modules/electron/dist/electron.exe');

export class SimpleWindow extends EventEmitter {
    private server: dgram.Socket = dgram.createSocket('udp4');
    private childPort!: number;
    private readyPromise: Promise<void>;
    public pids: number[] = [];

    constructor() {
        super();
        let readyPromiseResolve: () => void;
        this.readyPromise = new Promise<void>(resolve => { readyPromiseResolve = resolve; });
        this.server.bind();
        (async () => {
            await new Promise(resolve => this.server.once('listening', resolve));
            const oldPids = await findProcess(electronPath);
            execPowerShell(`&'${electronPath}' ./test/SimpleWindow/run.js ${this.server.address().port}`);
            await new Promise<void>(resolve => this.server.once('message', (msg) => {
                resolve();
                this.childPort = parseInt(msg.toString('utf-8').replace('ok ', ''));
            }));
            this.pids = (await findProcess(electronPath)).filter(i => !oldPids.includes(i));
            this.emit('ready');
            readyPromiseResolve!();
        })();
    }

    public whenReady() {
        return this.readyPromise;
    }

    public async run(jsCode: string) {
        this.server.send(jsCode, this.childPort, '127.0.0.1');
        await new Promise<void>(resolve => {
            const callback = (msg: Buffer) => {
                if (msg.toString('utf-8') === 'ack') {
                    resolve();
                    this.server.off('message', callback);
                }
            };
            this.server.on('message', callback);
        });
    }

    public async destroy() {
        await execPowerShell(`taskkill /f /pid ${this.pids.join(' /pid ')}`);
        this.server.unref();
    }
}
