/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-white': 'var(--sonus-color-bg-white)',
        'bg-blue': 'var(--sonus-color-bg-blue)',
        'bg-warm': 'var(--sonus-color-bg-warm)',
        'bg-warm-deep': 'var(--sonus-color-bg-warm-deep)',
        'text-dark': 'var(--sonus-color-text-dark)',
        'text-med': 'var(--sonus-color-text-med)',
        'text-light': 'var(--sonus-color-text-light)',
        'blue': 'var(--sonus-palette-blue)',
        'blue-subtle': '#D7E7EE',
        'green': 'var(--sonus-palette-green)',
        'orange': '#f97316',
        'red': '#ef4444',
        'tropical-coral': '#FCA47C',
        'tropical-aqua': '#23CED9',
        'tropical-gold': '#F9D779',
        'tropical-sage': '#A1CCA6',
        'tropical-teal': '#097C87',
        'border': 'var(--sonus-color-border)',
      },
      fontFamily: {
        'sans': ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        'mono': ['"DM Mono"', 'monospace'],
        'main': ['"Tenor Sans"', 'sans-serif'],
        'secondary': ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        'noto-serif': ['"Noto Serif SC"', 'serif'],
        'dm-mono': ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
