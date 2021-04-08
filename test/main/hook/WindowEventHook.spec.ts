import { expect } from 'chai';
import EventEmitter from 'events';
import dgram from 'dgram';
import path from 'path';
import { WindowEventHook } from '@main/hook/windowEventHook';
import { execPowerShell, findProcess } from '@main/win32';

const electronPath = path.join(process.cwd(), './node_modules/electron/dist/electron.exe');

describe('WindowEventHook', function() {
    let event: EventEmitter;
    let hook: WindowEventHook;
    let server: dgram.Socket;
    let pids: number[];

    before(async function() {
        this.timeout(5000);
        server = dgram.createSocket('udp4');
        server.bind(54321);
        event = new EventEmitter();
        await new Promise(resolve => server.once('listening', resolve));
        const oldPids = await findProcess(electronPath);
        execPowerShell(`&'${electronPath}' ./test/SimpleWindow/index.js`);
        await new Promise(resolve => server.once('message', resolve));
        pids = (await findProcess(electronPath)).filter(i => !oldPids.includes(i));
    });

    after(async function() {
        await execPowerShell(`taskkill /f /pid ${pids.join(' /pid ')}`);
        server.unref();
    });

    beforeEach(function() {
        hook = new WindowEventHook(event, pids);
    });

    afterEach(function() {
        hook.destroy();
    });

    it('window-minimize', async function() {
        server.send('window.restore(); window.minimize();', 54322, '127.0.0.1');
        const ret = await Promise.race([
            new Promise<any>(resolve => setTimeout(() => resolve(null), 1000)),
            new Promise<any>(resolve => event.once('window-minimize', () => resolve(1)))
        ]);
        expect(ret).to.not.equal(null);
    });

    it('window-restore', async function() {
        server.send('window.minimize(); window.restore();', 54322, '127.0.0.1');
        const ret = await Promise.race([
            new Promise<any>(resolve => setTimeout(() => resolve(null), 1000)),
            new Promise<any>(resolve => event.once('window-restore', () => resolve(1)))
        ]);
        expect(ret).to.not.equal(null);
    });
});
