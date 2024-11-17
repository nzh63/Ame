import logger from '@logger/provider/segment/mecab';
import { defineSegmentProvider } from '@main/providers/segment';
import { spawn } from 'child_process';
import { promises as fsPromises } from 'fs';
import { encode, decode } from 'iconv-lite';

export default defineSegmentProvider({
  id: 'mecab',
  optionsSchema: {
    enable: Boolean,
    exePath: String,
    encoding: ['Shift_JIS', 'UTF-8', 'UTF-16', 'EUC-JP'],
  } as const,
  defaultOptions: {
    enable: false,
    exePath: 'C:/Program Files (x86)/MeCab/bin/mecab.exe',
    encoding: 'Shift_JIS',
  },
  optionsDescription: {
    enable: '启用',
    exePath: 'mecab.exe路径',
    encoding: '编码格式',
  },
  data() {
    return {
      fileExist: false,
    };
  },
  async init() {
    if (!this.enable) return;
    try {
      await fsPromises.stat(this.exePath);
      this.fileExist = true;
    } catch (e) {}
  },
  isReady() {
    return this.enable && this.fileExist;
  },
  async segment(text) {
    const exe = spawn(this.exePath, { stdio: 'pipe' });
    exe.stdin.end(encode(text, this.encoding));
    let output = '';
    exe.stdout.on('data', (data) => {
      output += decode(Buffer.from(data), this.encoding);
    });
    await new Promise((resolve) => {
      exe.stdout.once('close', resolve);
    });
    logger(output);
    return output.split('\n').flatMap((i) => {
      const [, word, desc] = /^(.+)\t(.*)/.exec(i) ?? ([] as undefined[]);
      if (word === undefined) return [];
      let extraInfo: string | undefined;
      if (desc) {
        let [, type, conjugation, original] = /(.+?,.+?,.+?,.+?),(.+?,.+?),(.+?),/.exec(desc) ?? ([] as undefined[]);
        if (type)
          type = type
            .split(',')
            .filter((i) => i !== '*')
            .join('/');
        if (conjugation)
          conjugation = conjugation
            .split(',')
            .filter((i) => i !== '*')
            .join('/');
        if (original === word || original === '*') original = undefined;
        else if (original) original = '原形: ' + original;
        extraInfo = [type, conjugation, original].filter((i) => i).join('\n');
      }
      return [{ word, extraInfo }];
    });
  },
});
