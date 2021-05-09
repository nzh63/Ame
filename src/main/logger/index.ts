import debug from 'debug';
if (import.meta.env.DEV) {
    debug.enable('ame:main,ame:main:*,ame:render,ame:render:*');
    debug.log = console.log.bind(console);
}
export default debug('ame:main');
