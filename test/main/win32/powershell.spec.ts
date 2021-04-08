/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { execPowerShell } from '@main/win32/powershell';

describe('powershell', function() {
    before(function() {
    });

    after(function() {
    });

    it('execPowerShell', async function() {
        const ret = await execPowerShell('Get-Help');
        expect(ret.stdout).to.be.a('string');
        expect(ret.stderr).to.be.a('string');
        expect(ret.stdout).not.to.be.empty;
    });
});
