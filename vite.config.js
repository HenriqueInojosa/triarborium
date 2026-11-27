import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ASSETS_DIR = fileURLToPath(new URL('./public/assets', import.meta.url));

// Gera o módulo "virtual:assets" a partir dos arquivos em public/assets/:
//  - ASSET_EXT: { id: extensão } para cada imagem (exceto as variações -s1/-s2)
//  - SAN_VAR: ids que têm variações de sanidade (id-s1.ext e id-s2.ext)
function assetsList() {
  const ID = 'virtual:assets', RID = '\0' + ID;
  const build = () => {
    const ext = {}, variants = new Set();
    for (const f of readdirSync(ASSETS_DIR)) {
      const m = /^(.+)\.([a-z0-9]+)$/i.exec(f);
      if (!m) continue;
      const v = /^(.+)-s[12]$/.exec(m[1]);
      if (v) variants.add(v[1]);
      else ext[m[1]] = m[2];
    }
    const san = [...variants].filter(id => ext[id]);
    return `export const ASSET_EXT=${JSON.stringify(ext)};\nexport const SAN_VAR=new Set(${JSON.stringify(san)});\n`;
  };
  return {
    name: 'triarborium-assets',
    resolveId: id => (id === ID ? RID : null),
    load: id => (id === RID ? build() : null),
    configureServer(server) {
      // no "npm run dev", uma imagem nova em public/assets/ recarrega a lista
      server.watcher.add(ASSETS_DIR);
      const reload = f => {
        if (!f.startsWith(ASSETS_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

export default defineConfig({
  plugins: [assetsList()],
  build: {
    // JS/CSS gerados vão para dist/static/; as imagens continuam em dist/assets/ (vindas de public/assets/)
    assetsDir: 'static',
  },
});
