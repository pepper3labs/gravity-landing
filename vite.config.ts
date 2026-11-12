import { defineConfig } from 'vite';
export default defineConfig({
  server:{host:'0.0.0.0',port:10453,strictPort:true,watch:{ignored:['**/artifacts/**']}},
  build:{rollupOptions:{output:{manualChunks:{phaser:['phaser']}}}},
});
