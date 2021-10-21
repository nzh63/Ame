import EventEmitter from 'events';
import http from 'http';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { execPowerShell, findProcess } from '@main/win32';
import fetch from 'electron-fetch';

const electronPath = path.join(process.cwd(), './node_modules/electron/dist/electron.exe');

export class SimpleWindow extends EventEmitter {
    private server?: http.Server;
    private child?: ChildProcess;
    private childPort!: number;
    private readyPromise: Promise<void>;
    public pids: number[] = [];

    constructor() {
        super();
        // eslint-disable-next-line no-async-promise-executor
        this.readyPromise = new Promise<void>(async resolve => {
            for (let i = 1; i <= 3; i++) {
                await Promise.race([
                    this.startChild(),
                    new Promise(resolve => setTimeout(resolve, i * 3 * 1000))
                ]);
                if (this.pids.length) {
                    resolve();
                    break;
                } else {
                    this.closeServer();
                }
            }
        });
    }

    private startChild() {
        this.child?.kill();
        this.child = undefined;
        return new Promise<void>(resolve => {
            findProcess(electronPath)
                .then(oldPids => {
                    this.closeServer();
                    this.server = http.createServer(async (req, resp) => {
                        if (req.socket.remoteAddress === '127.0.0.1') {
                            let msg = '';
                            req.on('data', data => { msg += '' + data; });
                            await new Promise(resolve => req.once('end', resolve));
                            this.childPort = parseInt(msg);
                            resp.end();
                            this.closeServer();
                            this.pids = (await findProcess(electronPath)).filter(i => !oldPids.includes(i));
                            this.emit('ready');
                            resolve();
                        } else {
                            resp.end();
                        }
                    });
                    this.server.listen(0, '127.0.0.1');
                })
                .then(() => new Promise(resolve => this.server?.once('listening', resolve)))
                .then(() => {
                    this.child = spawn(electronPath, ['./test/SimpleWindow/run.js', '' + (this.server?.address() as any).port], { cwd: path.join(__dirname, '../..') });
                });
        });
    }

    private closeServer() {
        this.server?.close();
        this.server?.unref();
        this.server = undefined;
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
        this.server?.unref();
    }
}
