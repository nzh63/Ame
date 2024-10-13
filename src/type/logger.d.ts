declare module '@logger/*' {
  let d: (formatter: any, ...args: any[]) => void;
  export default d;
}
declare module '@logger' {
  let d: (formatter: any, ...args: any[]) => void;
  export default d;
}
