import MagicString, { SourceMap } from 'magic-string';
import path from 'path';
import { Plugin } from 'rollup';
import ts from 'typescript';
import { createFilter, FilterPattern } from '@rollup/pluginutils';

interface Options {
    logFunction: { [i: string]: string };
    include?: FilterPattern;
    exclude?: FilterPattern;
    sourceMap?: boolean;
    sourcemap?: boolean;
    loggerPath?: string;
    disableLog?: boolean;
}
interface Result {
    code: string;
    map?: SourceMap
}

function escape(str: string) {
    return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

export default function replace(options: Options = { logFunction: {} }) {
    const filter = createFilter(options.include, options.exclude);
    const pattern = new RegExp(`(?<![a-zA-Z0-9.])(${Object.keys(options.logFunction).map(i => escape(i)).join('|')})[\\b\\n]*\\([\\b\\n]*(['"\`]?)`, 'g');

    function executeModify(code: string, id: string) {
        const magicString = new MagicString(code);
        const modify = options.disableLog === true ? codeRemove : codeReplace;
        if (!modify(code, id, magicString)) {
            return null;
        }
        const result: Result = { code: magicString.toString() };
        if (isSourceMapEnabled()) {
            result.map = magicString.generateMap({ source: id, hires: true });
        }
        return result;
    }

    function codeReplace(code: string, id: string, magicString: MagicString) {
        let result = false;
        let match: RegExpExecArray;

        const fileName = path.relative(path.join(__dirname, '..'), id);
        let codeSplit: string[] | null = null;

        while ((match = pattern.exec(code))) {
            result = true;
            if (!codeSplit) codeSplit = code.split('\n');
            const quote = match[2];
            const start = match.index;
            const end = start + match[0].length;
            let line = 0; let cur = 0;
            while (cur + codeSplit[line].length + 1 <= start) {
                cur += codeSplit[line].length + 1;
                line++;
            }
            line++;
            const execLogFunctionName = options.logFunction[match[1]];
            const replacement = quote
                ? `${execLogFunctionName}(${quote}[${JSON.stringify(fileName).slice(1, -1)}:${line}] `
                : `${execLogFunctionName}('[${JSON.stringify(fileName).slice(1, -1)}:${line}] %O', `;
            magicString.overwrite(start, end, replacement);
        }
        return result;
    }
    function codeRemove(code: string, id: string, magicString: MagicString) {
        if (!pattern.test(code)) return false;
        function walk(node: ts.SourceFile, callback: (node: ts.Node) => boolean | void) {
            function visit(node: ts.Node) {
                if (!callback(node)) { ts.forEachChild(node, visit); }
            }
            if (!callback(node)) { ts.forEachChild(node, visit); }
        }
        try {
            walk(ts.createSourceFile(id, code, ts.ScriptTarget.ESNext, true), (node) => {
                if (node.kind === ts.SyntaxKind.CallExpression) {
                    if (Object.keys(options.logFunction).includes((node as ts.CallExpression).expression.getText())) {
                        magicString.overwrite(node.getStart(), node.getEnd(), '(void 0)');
                        return true;
                    }
                }
            });
        } catch (e) {
            return false;
        }

        return true;
    }

    function isSourceMapEnabled() {
        return options.sourceMap !== false && options.sourcemap !== false;
    }

    return {
        name: 'log',
        enforce: 'pre',
        renderChunk(code: string, chunk: { fileName: string; }) {
            const id = chunk.fileName;
            if (!filter(id)) return null;
            if (id.endsWith('/')) return null;
            return executeModify(code, id);
        },

        transform(code: string, id: string) {
            if (!filter(id)) return null;
            if (id.endsWith('/')) return null;
            return executeModify(code, id);
        },

        resolveId(id) {
            if (id.startsWith('@logger')) {
                return id;
            }
        },
        load(id) {
            if (id.startsWith('@logger')) {
                if (options.disableLog !== true) {
                    const namespace = /@logger\//.test(id) ? id.substring(id.lastIndexOf('@logger/') + '@logger/'.length).replace(/\//g, ':') : undefined;
                    return `import logger from '${options.loggerPath ? options.loggerPath : 'debug'}'
                            const logger2 = ${options.loggerPath ? 'logger' : 'logger("")'}
                            ${namespace ? `export default logger2.extend('${namespace}')` : 'export default logger2'}`;
                } else {
                    return `function logger() {}
                            export default logger`;
                }
            }
        }
    } as Plugin;
}
