import debug from 'debug';
debug.enable('ame:main:*');
if (import.meta.env.DEV) {
    debug.enable('ame:main,ame:main:*,ame:render,ame:render:*');
    debug.log = console.log.bind(console);
}
export default debug('ame:main');
