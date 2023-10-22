/* eslint-disable @typescript-eslint/no-non-null-assertion */
import EventEmitter from 'events';
import http from 'http';
import path from 'path';
import { execPowerShell, findProcess } from '@main/win32';
import fetch from 'electron-fetch';
import logger from '@logger/test/SimpleWindow';
import { spawn } from 'child_process';

const electronPath = path.join(process.cwd(), './node_modules/electron/dist/electron.exe');

export class SimpleWindow extends EventEmitter {
    private server!: http.Server;
    private childPort!: number;
    private readyPromise: Promise<void>;
    public pids: number[] = [];

    constructor() {
        super();
        let readyPromiseResolve: () => void;
        this.readyPromise = new Promise<void>(resolve => { readyPromiseResolve = resolve; });
        (async () => {
            const oldPids = await findProcess(electronPath);
            this.server = http.createServer(async (req, resp) => {
                if (req.socket.remoteAddress === '127.0.0.1') {
                    let msg = '';
                    req.on('data', data => { msg += '' + data; });
                    await new Promise(resolve => req.once('end', resolve));
                    this.childPort = parseInt(msg);
                    resp.end();
                    this.server.close();
                    this.server.unref();
                    this.pids = (await findProcess(electronPath)).filter(i => !oldPids.includes(i));
                    this.emit('ready');
                    readyPromiseResolve!();
                } else {
                    resp.end();
                }
            });
            this.server.listen(0, '127.0.0.1');
            logger('create http server...');
            await new Promise(resolve => this.server.once('listening', resolve));
            logger('http server listen on %o', this.server.address());
            const child = spawn(
                electronPath,
                ['./test/SimpleWindow/run.js', '' + (this.server.address() as any).port],
                { stdio: 'inherit' }
            );
            child.unref();
        })();
    }

    public whenReady() {
        return this.readyPromise;
    }

    public run(jsCode: string) {
        return fetch(`http://127.0.0.1:${this.childPort}`, { method: 'post', body: jsCode });
    }

    public async destroy() {
        try {
            await execPowerShell(`taskkill /f /pid ${this.pids.join(' /pid ')}`);
        } catch (e) { }
        this.server.unref();
    }
}
