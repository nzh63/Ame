import { __static } from '@main/paths';
import { defineTranslateProvider } from '@main/providers/translate';
import { TaskQueue } from '@main/utils';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { range } from 'lodash-es';
import path from 'path';

export default defineTranslateProvider({
  id: 'JBeijing',
  description: '离线翻译器，你可以在 https://www.kodensha.jp/index/products/jb/ 购买\n只支持日译中',
  optionsSchema: {
    enable: Boolean,
    path: {
      dll: [String, null],
      userDicts: {
        type: Array,
        items: String,
      },
    },
  } as const,
  defaultOptions: {
    enable: true,
    path: {
      dll: null,
      userDicts: [],
    },
  },
  optionsDescription: {
    enable: '启用',
    path: {
      dll: 'JBJCT.dll 的路径',
      userDicts: range(1, 4).map((i) => `用户辞书${i}的路径`),
    },
  },
  data() {
    return {
      process: null as ChildProcess | null,
      taskQueue: new TaskQueue(),
    };
  },
  init() {
    if (!this.enable || !this.path.dll) return;
    this.process = spawn(
      path.join(__static, 'native/bin/JBeijingCli.exe'),
      [this.path.dll, ...this.path.userDicts.filter((i) => i.trim()), '', '', ''],
      { stdio: 'pipe' },
    );
  },
  isReady() {
    return this.enable && !!this.path.dll && !!this.process && this.process.exitCode === null;
  },
  async translate(t) {
    if (!this.process) throw new Error('cli process not init');
    return this.taskQueue.dispatch(() => {
      const input = Buffer.from(t, 'ucs2');
      const inputSize = Buffer.alloc(2);
      inputSize.writeUInt16LE(input.length);
      this.process?.stdin?.write(inputSize);
      this.process?.stdin?.write(input);
      let output = Buffer.alloc(0);
      let outputSize = Buffer.alloc(0);
      return new Promise<string>((resolve) => {
        const callback = (_c: any) => {
          let c = Buffer.from(_c);
          if (outputSize.length < 2) {
            const oldLength = outputSize.length;
            outputSize = oldLength ? Buffer.concat([outputSize, c.slice(0, 2 - oldLength)]) : c.slice(0, 2);
            c = c.slice(outputSize.length - oldLength);
          }
          if (c.length) {
            output = output.length ? Buffer.concat([output, c]) : c;
            if (output.length >= outputSize.readUInt16LE()) {
              finish();
            }
          }
        };
        const finish = () => {
          clearTimeout(timeoutId);
          resolve(output.toString('ucs2'));
          this.process?.stdout?.off('data', callback);
        };
        const timeoutId = setTimeout(finish, 1000);
        this.process?.stdout?.on('data', callback);
      });
    });
  },
  destroy() {
    this.process?.stdin?.write(Buffer.alloc(2, 0));
    setTimeout(() => {
      if (this.process && this.process.exitCode === null) this.process.kill();
    }, 500);
  },
});
