/** A structure file, parsed at build time by `vitePlugin.ts`. */
declare module '*.structure' {
  const structure: import('./parse').Structure;
  export default structure;
}
