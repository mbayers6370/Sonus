import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor';
          }

          if (id.includes('/src/components/internal/SupportConsolePage')) return 'support-console';
          if (id.includes('/src/routes/LessonRouteController') || id.includes('/src/components/Lesson')) {
            return 'lesson-flow';
          }
          if (id.includes('/src/components/Travel') || id.includes('/src/routes/profileTravelRoutes')) {
            return 'travel-mode';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'src/routes/**/*.ts', 'src/routes/**/*.tsx'],
    },
  },
})
