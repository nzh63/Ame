import { findProcess, waitProcessForExit } from '@main/win32/process';
import { expect } from 'chai';
import { spawn } from 'child_process';

describe('process', () => {
  before(() => {});

  after(() => {});

  it('findProcess', async () => {
    const pids = await findProcess(process.argv0);
    expect(pids).to.be.an('array');
    expect(pids).not.to.be.empty;
    pids.forEach((i) => expect(i).to.be.a('number'));
  });

  it('waitProcessForExit', async function () {
    this.retries(5);
    this.timeout(5000);
    const processes = Object.keys(Array.from({ length: 5 })).map((i) =>
      spawn('powershell', ['/C', 'sleep', '0.00' + i]),
    );
    processes.forEach((i) => expect(i.exitCode).to.be.null);
    await waitProcessForExit(processes.map((i) => i.pid).filter((i) => i) as number[]);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    processes.forEach((i) => expect(i.exitCode).to.equal(0));
  });

  it('waitProcessForExit - empty pids', async function () {
    this.timeout(32);
    await waitProcessForExit([]);
  });
});
