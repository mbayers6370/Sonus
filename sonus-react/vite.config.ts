import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function prioritizeEntryStylesheet() {
  return {
    name: 'prioritize-entry-stylesheet',
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string) {
        const scriptRe = /<script type="module"[^>]*src="\/assets\/index-[^"]+\.js"[^>]*><\/script>/;
        const styleRe = /<link rel="stylesheet"[^>]*href="\/assets\/index-[^"]+\.css"[^>]*>/;
        const scriptMatch = html.match(scriptRe);
        const styleMatch = html.match(styleRe);
        if (!scriptMatch || !styleMatch) return html;

        const scriptTag = scriptMatch[0];
        const styleTag = styleMatch[0];
        if (html.indexOf(styleTag) < html.indexOf(scriptTag)) return html;

        const withoutStyle = html.replace(styleTag, '');
        return withoutStyle.replace(scriptTag, `${styleTag}\n    ${scriptTag}`);
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), prioritizeEntryStylesheet()],
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
