import { expect } from 'chai';
import EventEmitter from 'events';
import { WindowEventHook } from '@main/hook/windowEventHook';
import { SimpleWindow } from '../../SimpleWindow';

describe('WindowEventHook', function() {
    let event: EventEmitter;
    let hook: WindowEventHook;
    let window: SimpleWindow;

    before(async function() {
        this.timeout(10000);
        event = new EventEmitter();
        window = new SimpleWindow();
        await window.whenReady();
    });

    after(async function() {
        await window.destroy();
    });

    beforeEach(async function() {
        hook = await WindowEventHook.create(event, window.pids);
    });

    afterEach(function() {
        hook.destroy();
    });

    it('window-minimize', async function() {
        window.run('window.restore(); window.minimize();');
        const ret = await Promise.race([
            new Promise<any>(resolve => setTimeout(() => resolve(null), 1000)),
            new Promise<any>(resolve => event.once('window-minimize', () => resolve(1)))
        ]);
        expect(ret).to.not.equal(null);
    });

    it('window-restore', async function() {
        window.run('window.minimize(); window.restore();');
        const ret = await Promise.race([
            new Promise<any>(resolve => setTimeout(() => resolve(null), 1000)),
            new Promise<any>(resolve => event.once('window-restore', () => resolve(1)))
        ]);
        expect(ret).to.not.equal(null);
    });
});
