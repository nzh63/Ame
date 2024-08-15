import { Plugin } from 'rollup';

export default function devSpeedup() {
    return {
        name: 'dev-speedup',
        async resolveId(id) {
            if (id === 'lodash-es') id = 'lodash';
            if (/^(\.|@main|@render|@static|@assets)/.test(id.trim())) return null;
            if (id.includes('web-streams-polyfill')) return null;
            let tryId = id;
            while (tryId) {
                try {
                    const tryPackage = tryId + '/package.json';
                    if (import.meta.resolve('../package.json') === import.meta.resolve(tryPackage)) {
                        throw new Error();
                    }
                    const packageJson = await import(tryPackage, { with: { type: 'json' } });
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
