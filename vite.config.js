import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login.html'),
                print: resolve(__dirname, 'print.html'),
                brokerage: resolve(__dirname, 'brokerage.html'),
                initdb: resolve(__dirname, 'init-db.html'),
            },
        },
    },
    server: {
        port: 3000,
        open: '/login.html',
    },
});
