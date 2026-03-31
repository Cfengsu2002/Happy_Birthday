import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages project site: https://<user>.github.io/Happy_Birthday/
const GP_BASE = '/Happy_Birthday/'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? GP_BASE : '/',
}))
