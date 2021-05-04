import { Plugin } from 'rollup';

export default function devSpeedup() {
    return {
        name: 'dev-speedup',
        resolveId(id) {
            if (id === 'lodash-es') id = 'lodash';
            if (id.trim().startsWith('.')) return null;
            try {
                const packageJson = require(id + '/package.json');
                if (packageJson.type !== 'module') {
                    return {
                        id,
                        external: true
                    };
                }
            } catch (e) {
            }
            return null;
        }
    } as Plugin;
}
