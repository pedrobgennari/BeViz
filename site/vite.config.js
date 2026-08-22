import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    base: './',
    build: {
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                blackbody: resolve(__dirname, 'html/blackbody.html'),
                bestar: resolve(__dirname, 'html/bestar.html'),
            }
        }
    }
});
