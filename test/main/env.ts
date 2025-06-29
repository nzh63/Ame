import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import dotenv from 'dotenv';

chai.use(chaiAsPromised);
['.env', '.env.local', '.env.test', '.env.test.local'].forEach((path) => {
  try {
    dotenv.config({ path, quiet: true });
  } catch (e) {}
});
