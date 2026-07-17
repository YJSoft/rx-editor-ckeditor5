import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'es2020',
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        sourcemap: false,
        lib: {
            entry: 'src/main.js',
            formats: ['es'],
            fileName: () => 'ckeditor5.js',
            cssFileName: 'ckeditor5',
        },
        rollupOptions: {
            output: {
                assetFileNames: 'ckeditor5.[ext]',
            },
        },
    },
});
