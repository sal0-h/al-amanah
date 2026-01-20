/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MSA Brand Colors
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#f5b8b8',
          300: '#eb8989',
          400: '#e05050',
          500: '#C4122F',  // Main Crimson
          600: '#b01029',
          700: '#9c0e24',
          800: '#850c1f',
          900: '#6e0a19',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#FDB913',  // Main Amber Gold
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        serif: ['Playfair Display', 'Merriweather', 'Georgia', 'serif'],
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
