/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { execPowerShell } from '@main/win32/powershell';

describe('powershell', function() {
    before(function() {
    });

    after(function() {
    });

    it('execPowerShell', async function() {
        const ret = await execPowerShell('Write-Output foo');
        expect(ret.stdout).to.be.a('string').and.not.to.be.empty;
        expect(ret.stderr).to.be.a('string');
    });
});
