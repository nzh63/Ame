import debug from 'debug';

if (import.meta.env.LOGGING) {
  debug.log = console.log.bind(console);
}
export default debug('ame:main');
