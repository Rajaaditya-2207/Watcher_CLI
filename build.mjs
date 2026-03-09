import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const options = {
    entryPoints: ['src/cli.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: 'dist/cli.js',
    packages: 'external', // keep all npm packages as external imports
    sourcemap: true,
    target: 'node16',
    jsx: 'automatic', // React 17+ JSX transform (no need to import React)
    logLevel: 'info',
};

if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('Watching for changes...');
} else {
    await esbuild.build(options);
}
