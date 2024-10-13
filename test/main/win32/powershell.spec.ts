import { execPowerShell } from '@main/win32/powershell';
import { expect } from 'chai';

describe('powershell', () => {
  before(() => {});

  after(() => {});

  it('execPowerShell', async function () {
    this.timeout(10000);
    const ret = await execPowerShell('Write-Output foo');
    expect(ret.stdout).to.be.a('string').and.not.to.be.empty;
    expect(ret.stderr).to.be.a('string');
  });
});
