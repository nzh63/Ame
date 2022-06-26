import { Plugin } from 'rollup';

export default function devSpeedup() {
    return {
        name: 'dev-speedup',
        resolveId(id) {
            if (id === 'lodash-es') id = 'lodash';
            if (id.trim().startsWith('.')) return null;
            let tryId = id;
            while (tryId) {
                try {
                    const tryPackage = tryId + '/package.json';
                    if (require.resolve('../package.json') === require.resolve(tryPackage)) { throw new Error(); }
                    const packageJson = require(tryPackage);
                    if (packageJson.type !== 'module') {
                        return {
                            id,
                            external: true
                        };
                    } else {
                        return null;
                    }
                } catch (e) {
                    tryId = tryId.substring(0, tryId.lastIndexOf('/'));
                }
            }
            return null;
        }
    } as Plugin;
}
