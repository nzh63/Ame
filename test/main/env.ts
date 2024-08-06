import dotenv from 'dotenv';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
[
    '.env',
    '.env.local',
    '.env.test',
    '.env.test.local'
].forEach(path => {
    try {
        dotenv.config({ path });
    } catch (e) { }
});
