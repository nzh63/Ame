/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { spawn } from 'child_process';
import { findProcess, waitProcessForExit } from '@main/win32/process';

describe('process', function() {
    before(function() {
    });

    after(function() {
    });

    it('findProcess', async function() {
        const pids = await findProcess(process.argv0);
        expect(pids).to.be.an('array');
        expect(pids).not.to.be.empty;
        pids.forEach(i => expect(i).to.be.a('number'));
    });

    it('waitProcessForExit', async function() {
        this.retries(5);
        const processes = Object.keys(Array.from({ length: 5 }))
            .map(i => spawn('powershell', ['/C', 'sleep', '0.00' + i]));
        processes.forEach(i => expect(i.exitCode).to.be.null);
        await waitProcessForExit(processes.map(i => i.pid));
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
        processes.forEach(i => expect(i.exitCode).to.equal(0));
    });

    it('waitProcessForExit - empty pids', async function() {
        this.timeout(1);
        await waitProcessForExit([]);
    });
});
