/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-white': '#ffffff',
        'bg-blue': '#f0f7ff',
        'bg-warm': '#FBFBF9',
        'bg-warm-deep': '#F1EFEA',
        'text-dark': '#1F2A37',
        'text-med': '#64748b',
        'text-light': '#94a3b8',
        'blue': '#3b82f6',
        'blue-subtle': '#dbeafe',
        'green': '#10b981',
        'orange': '#f97316',
        'red': '#ef4444',
        'tropical-coral': '#FCA47C',
        'tropical-aqua': '#23CED9',
        'tropical-gold': '#F9D779',
        'tropical-sage': '#A1CCA6',
        'tropical-teal': '#097C87',
        'border': '#E6E3DC',
      },
      fontFamily: {
        'sans': ['"Lato"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        'mono': ['"DM Mono"', 'monospace'],
        'playfair': ['"Playfair Display"', 'serif'],
        'noto-serif': ['"Noto Serif SC"', 'serif'],
        'dm-mono': ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
