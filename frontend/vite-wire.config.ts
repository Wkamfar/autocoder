import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-wire',
    sourcemap: false, // Disable source maps for production
    rollupOptions: {
      input: path.resolve(__dirname, 'index-wire.html'),
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pose/sdk': path.resolve(__dirname, './src/sdk/pose')
    }
  },
  base: '/v2/', // Served under /v2/ on wire.pose.xyz
})
