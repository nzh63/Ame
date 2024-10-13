import { Plugin } from 'rollup';
import builtinModules from 'builtin-modules';

const externalPackages = [
    'electron',
    'electron/main',
    'electron/common',
    'electron/renderer',
    'sharp',
    ...builtinModules
];

// 不要把主进程下的文件打包进渲染进程
export default function renderResolver() {
    return {
        name: 'render-resolver',
        enforce: 'pre',
        resolveId(id) {
            if (id.startsWith('@main') || externalPackages.includes(id)) {
                return id;
            }
            return null;
        },
        async load(id) {
            if (id.startsWith('@main') || externalPackages.includes(id)) {
                return {
                    code: `const m = require('${id}');export default m`,
                    syntheticNamedExports: true
                };
            }
        }
    } as Plugin;
}
