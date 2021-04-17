
import { Plugin } from 'rollup';

// 针对vite仅为浏览器设计的临时措施
// 将tesseract给浏览器准备的包替换为为node准备的包
// vite的确不适合用来打包主进程，准备换成rollup
export default function() {
    return {
        name: 'tesseract',
        enforce: 'pre',

        resolveId(id) {
            if (/node_modules[/\\]tesseract\.js[/\\]src[/\\]worker[/\\]browser[/\\]index.js/.test(id)) {
                return id;
            }
        },
        load(id) {
            if (/node_modules[/\\]tesseract\.js[/\\]src[/\\]worker[/\\]browser[/\\]index.js/.test(id)) {
                return `/**
 *
 * Tesseract Worker impl. for node (using child_process)
 *
 * @fileoverview Tesseract Worker impl. for node
 * @author Kevin Kwok <antimatter15@gmail.com>
 * @author Guillermo Webster <gui@mit.edu>
 * @author Jerome Wu <jeromewus@gmail.com>
 */
const defaultOptions = require('tesseract.js/src/worker/node/defaultOptions');
const spawnWorker = require('tesseract.js/src/worker/node/spawnWorker');
const terminateWorker = require('tesseract.js/src/worker/node/terminateWorker');
const onMessage = require('tesseract.js/src/worker/node/onMessage');
const send = require('tesseract.js/src/worker/node/send');
const loadImage = require('tesseract.js/src/worker/node/loadImage');

export default {
    defaultOptions,
    spawnWorker,
    terminateWorker,
    onMessage,
    send,
    loadImage
};
`;
            }
        }
    } as Plugin;
}
