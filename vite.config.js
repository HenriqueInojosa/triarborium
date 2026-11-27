import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // JS/CSS gerados vão para dist/static/; as imagens continuam em dist/assets/ (vindas de public/assets/)
    assetsDir: 'static',
  },
});
