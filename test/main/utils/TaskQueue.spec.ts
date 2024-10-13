import { TaskQueue } from '@main/utils';
import { expect } from 'chai';

describe('TaskQueue', () => {
  it('acquire & release', async () => {
    const queue = new TaskQueue();

    const locked = await queue.acquire();

    // lock1 is pending
    const lock1 = queue.acquire();

    // lock2 will cancel lock1
    const lock2 = queue.acquire();
    await expect(lock1).to.be.rejectedWith('Canceled');

    // release locked will make lock2 be fulfilled
    locked.release();
    await expect(lock2).to.be.fulfilled;
  });
});
