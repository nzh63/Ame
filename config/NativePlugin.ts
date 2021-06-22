import path from 'path';
import fs from 'fs';
import { Plugin } from 'rollup';

export default function native() {
    return {
        name: 'native',
        resolveId(id) {
            if (id.startsWith('@addons/')) {
                return id;
            }
            return null;
        },
        async load(id) {
            if (id.startsWith('@addons/')) {
                const arch = process.env.npm_config_arch || process.arch;
                let file = id.replace(/^@addons\//, path.join(__dirname, `../dist/addons/${arch}/`));
                if (!file.endsWith('.node')) file += '.node';
                const ref = this.emitFile({
                    type: 'asset',
                    name: path.basename(file),
                    source: await fs.promises.readFile(file)
                });
                return {
                    code: `export default require(import.meta.NATIVE_FILE_${ref})`,
                    syntheticNamedExports: true
                };
            }
            return undefined;
        },
        resolveImportMeta(property, { chunkId }) {
            if (property.startsWith('NATIVE_FILE_')) {
                const ref = /^NATIVE_FILE_(.*)$/.exec(property)?.[1];
                if (ref) {
                    const requirePath = './' + path.relative(path.dirname(chunkId), this.getFileName(ref)).replace(/\\/g, '/');
                    return JSON.stringify(requirePath);
                }
            }
            return null;
        }
    } as Plugin;
}
