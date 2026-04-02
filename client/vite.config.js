import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Use 127.0.0.1 so Node does not prefer ::1; Uvicorn defaults to IPv4 only.
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
