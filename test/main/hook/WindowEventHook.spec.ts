import { SimpleWindow } from '../../SimpleWindow';
import { WindowEventHook } from '@main/hook/WindowEventHook';
import { expect } from 'chai';
import EventEmitter from 'events';

describe('WindowEventHook', () => {
  let event: EventEmitter;
  let hook: WindowEventHook;
  let window: SimpleWindow;

  before(async function () {
    this.timeout(10000);
    this.retries(3);
    event = new EventEmitter();
    window = new SimpleWindow();
    await window.whenReady();
  });

  after(async () => {
    await window.destroy();
  });

  beforeEach(async () => {
    hook = await WindowEventHook.create(event, window.pids);
  });

  afterEach(() => {
    hook.destroy();
  });

  it('window-minimize', async () => {
    window.run('window.restore(); window.minimize();');
    const ret = await Promise.race([
      new Promise<any>((resolve) => {
        setTimeout(() => resolve(null), 1000);
      }),
      new Promise<any>((resolve) => {
        event.once('window-minimize', () => resolve(1));
      }),
    ]);
    expect(ret).to.not.equal(null);
  });

  it('window-restore', async () => {
    window.run('window.minimize(); window.restore();');
    const ret = await Promise.race([
      new Promise<any>((resolve) => {
        setTimeout(() => resolve(null), 1000);
      }),
      new Promise<any>((resolve) => {
        event.once('window-restore', () => resolve(1));
      }),
    ]);
    expect(ret).to.not.equal(null);
  });
});
