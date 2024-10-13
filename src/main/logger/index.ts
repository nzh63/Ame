import debug from 'debug';

if (import.meta.env.DEV) {
  debug.log = console.log.bind(console);
}
export default debug('ame:main');
