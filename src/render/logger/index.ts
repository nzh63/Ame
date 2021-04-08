import debug from 'debug';
if (import.meta.env.DEV) {
    debug.enable('ame:render,ame:render:*');
    debug.log = console.log.bind(console);
}
export default debug('ame:render');
