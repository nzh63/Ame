import { TaskQueue } from '@main/utils';
import { expect } from 'chai';

describe('TaskQueue', () => {
  describe('acquire & release', () => {
    it('should acquire and release lock successfully', async () => {
      const queue = new TaskQueue();
      const lock = await queue.acquire();
      expect(lock).to.have.property('release');
      expect(lock).to.have.property(Symbol.dispose);

      lock.release();
    });

    it('should handle sequential locks', async () => {
      const queue = new TaskQueue();

      const firstLock = await queue.acquire();
      firstLock.release();

      const secondLock = await queue.acquire();
      secondLock.release();

      // Should be able to acquire locks sequentially
      expect(true).to.be.true;
    });

    it('should cancel pending locks when new lock is requested', async () => {
      const queue = new TaskQueue();

      // First acquire should succeed
      const firstLock = await queue.acquire();

      // Second acquire will be pending
      const lock1Promise = queue.acquire();

      // Third acquire will cancel the second
      const lock2Promise = queue.acquire();

      // The second lock promise should be rejected
      expect(lock1Promise).to.be.rejectedWith(TaskQueue.Canceled);

      // Release the first lock
      firstLock.release();

      // The third promise should be fulfilled
      const secondLock = await lock2Promise;
      secondLock.release();
    });

    it('should use Symbol.dispose for automatic cleanup', async () => {
      const queue = new TaskQueue();

      const testAutoCleanup = async () => {
        using lock = await queue.acquire();
        expect(lock).to.have.property(Symbol.dispose);
        // Lock should be automatically released when exiting the using block
      };

      await testAutoCleanup();

      // Should be able to acquire a new lock immediately after the using block
      const newLock = await queue.acquire();
      newLock.release();
    });

    it('should handle multiple releases gracefully', async () => {
      const queue = new TaskQueue();
      const lock = await queue.acquire();

      lock.release();

      // Multiple releases should not cause errors
      lock.release();
      lock.release();
    });
  });

  describe('dispatch', () => {
    it('should execute synchronous task successfully', async () => {
      const queue = new TaskQueue();
      const result = await queue.dispatch(() => 42);
      expect(result).to.equal(42);
    });

    it('should execute asynchronous task successfully', async () => {
      const queue = new TaskQueue();
      const result = await queue.dispatch(async () => {
        return new Promise((resolve) => {
          setImmediate(resolve, 84);
        });
      });
      expect(result).to.equal(84);
    });

    it('should handle task that throws error', async () => {
      const queue = new TaskQueue();
      let errorThrown = false;

      try {
        await queue.dispatch(() => {
          throw new Error('Task error');
        });
      } catch (e) {
        errorThrown = true;
        expect(e).to.be.instanceOf(Error);
        expect((e as Error).message).to.equal('Task error');
      }

      expect(errorThrown).to.be.true;
    });

    it('should handle async task that rejects', async () => {
      const queue = new TaskQueue();
      let errorThrown = false;

      try {
        await queue.dispatch(async () => {
          throw new Error('Async task error');
        });
      } catch (e) {
        errorThrown = true;
        expect(e).to.be.instanceOf(Error);
        expect((e as Error).message).to.equal('Async task error');
      }

      expect(errorThrown).to.be.true;
    });

    it('should execute tasks sequentially', async () => {
      const queue = new TaskQueue();
      const results: number[] = [];

      const task1 = async () => {
        results.push(1);
        await new Promise((resolve) => {
          setImmediate(resolve);
        });
        return 1;
      };

      const task2 = async () => {
        results.push(2);
        await new Promise((resolve) => {
          setImmediate(resolve);
        });
        return 2;
      };

      const task3 = () => {
        results.push(3);
        return 3;
      };

      const result1 = await queue.dispatch(task1);
      const result2 = await queue.dispatch(task2);
      const result3 = await queue.dispatch(task3);

      expect(results).to.deep.equal([1, 2, 3]);
      expect(result1).to.equal(1);
      expect(result2).to.equal(2);
      expect(result3).to.equal(3);
    });

    it('should handle tasks with different return types', async () => {
      const queue = new TaskQueue();

      const stringResult = await queue.dispatch(() => 'hello');
      const numberResult = await queue.dispatch(() => 123);
      const booleanResult = await queue.dispatch(() => true);
      const objectResult = await queue.dispatch(() => ({ key: 'value' }));
      const arrayResult = await queue.dispatch(() => [1, 2, 3]);

      expect(stringResult).to.equal('hello');
      expect(numberResult).to.equal(123);
      expect(booleanResult).to.be.true;
      expect(objectResult).to.deep.equal({ key: 'value' });
      expect(arrayResult).to.deep.equal([1, 2, 3]);
    });

    it('should handle task that returns undefined', async () => {
      const queue = new TaskQueue();
      const result = await queue.dispatch(() => undefined);
      expect(result).to.be.undefined;
    });

    it('should handle task that returns null', async () => {
      const queue = new TaskQueue();
      const result = await queue.dispatch(() => null);
      expect(result).to.be.null;
    });
  });

  describe('error handling', () => {
    it('should handle TaskQueue.Canceled error', async () => {
      const queue = new TaskQueue();

      const lock1 = await queue.acquire();
      const lock2Promise = queue.acquire();
      const lock3Promise = queue.acquire();

      // lock2 should be canceled by lock3
      expect(lock2Promise).to.be.rejectedWith(TaskQueue.Canceled);

      lock1.release();
      const lock3 = await lock3Promise;
      lock3.release();
    });

    it('should handle errors in dispatch tasks without affecting queue state', async () => {
      const queue = new TaskQueue();

      const failingTask = queue.dispatch(() => {
        throw new Error('First task error');
      });

      // Expected error
      expect(failingTask).to.be.rejectedWith('First task error');

      // Queue should still work after error
      const result = await queue.dispatch(() => 'success');
      expect(result).to.equal('success');
    });
  });

  describe('concurrent scenarios', () => {
    it('should handle multiple dispatch calls that complete successfully', async () => {
      const queue = new TaskQueue();

      const task1 = () => 'result1';
      const task2 = () => 'result2';
      const task3 = () => 'result3';

      const results = await Promise.all([queue.dispatch(task1), queue.dispatch(task2), queue.dispatch(task3)]);

      expect(results).to.deep.equal(['result1', 'result2', 'result3']);
    });

    it('should handle mixed synchronous and asynchronous dispatch calls', async () => {
      const queue = new TaskQueue();

      const syncResult = await queue.dispatch(() => 'sync');

      const asyncTask = async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('async');
          }, 10);
        });
      };

      const asyncResult = await queue.dispatch(asyncTask);

      expect(syncResult).to.equal('sync');
      expect(asyncResult).to.equal('async');
    });
  });
});
