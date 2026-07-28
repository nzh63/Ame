import { IExtractor } from '@main/extractor/IExtractor';
import { expect } from 'chai';

class TestExtractor extends IExtractor {
  public paused = false;
  public destroyed = false;

  public pause() {
    this.paused = true;
  }

  public resume() {
    this.paused = false;
  }

  public destroy() {
    this.destroyed = true;
  }

  // Expose protected method for testing
  public testUpdate(key: string, text: string) {
    this.update(key, text);
  }
}

describe('IExtractor', () => {
  let extractor: TestExtractor;

  beforeEach(() => {
    extractor = new TestExtractor();
  });

  afterEach(() => {
    extractor.destroy();
  });

  it('should start with empty text result', () => {
    expect(extractor.text).to.deep.equal({});
  });

  it('should emit update:key event on update', (done) => {
    extractor.on('update:test', (result) => {
      expect(result).to.deep.equal({ key: 'test', text: 'hello' });
      done();
    });
    extractor.testUpdate('test', 'hello');
  });

  it('should emit update:any event on update', (done) => {
    extractor.on('update:any', (result) => {
      expect(result).to.deep.equal({ key: 'test', text: 'hello' });
      done();
    });
    extractor.testUpdate('test', 'hello');
  });

  it('should store text in result', () => {
    extractor.testUpdate('key1', 'value1');
    expect(extractor.text).to.deep.equal({ key1: 'value1' });
  });

  it('should not emit event for duplicate text', () => {
    let callCount = 0;
    extractor.on('update:test', () => callCount++);

    extractor.testUpdate('test', 'hello');
    extractor.testUpdate('test', 'hello'); // duplicate, should not emit

    expect(callCount).to.equal(1);
  });

  it('should not emit event for whitespace-only text', () => {
    let callCount = 0;
    extractor.on('update:test', () => callCount++);

    extractor.testUpdate('test', '   ');
    extractor.testUpdate('test', '');

    expect(callCount).to.equal(0);
    expect(extractor.text).to.deep.equal({});
  });

  it('should emit event when text changes', () => {
    const results: string[] = [];
    extractor.on('update:test', (r) => results.push(r.text));

    extractor.testUpdate('test', 'first');
    extractor.testUpdate('test', 'second');

    expect(results).to.deep.equal(['first', 'second']);
    expect(extractor.text).to.deep.equal({ test: 'second' });
  });

  it('should support multiple keys independently', () => {
    extractor.testUpdate('a', 'text-a');
    extractor.testUpdate('b', 'text-b');

    expect(extractor.text).to.deep.equal({ a: 'text-a', b: 'text-b' });
  });

  it('should support off to remove listeners', () => {
    let callCount = 0;
    const listener = () => callCount++;
    extractor.on('update:test', listener);

    extractor.testUpdate('test', 'first');
    extractor.off('update:test', listener);
    extractor.testUpdate('test', 'second');

    expect(callCount).to.equal(1);
  });

  it('should support once for one-time listeners', () => {
    let callCount = 0;
    extractor.once('update:test', () => callCount++);

    extractor.testUpdate('test', 'first');
    extractor.testUpdate('test', 'second');

    expect(callCount).to.equal(1);
  });

  it('should implement pause/resume/destroy', () => {
    extractor.pause();
    expect(extractor.paused).to.be.true;

    extractor.resume();
    expect(extractor.paused).to.be.false;

    extractor.destroy();
    expect(extractor.destroyed).to.be.true;
  });
});
