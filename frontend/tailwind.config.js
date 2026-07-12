/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14232C',
        paper: '#F3F5F4',
        paperRaised: '#FFFFFF',
        line: '#D8DCDB',
        ledger: {
          DEFAULT: '#0F6E56',
          light: '#E1F5EE',
          dark: '#04342C',
        },
        stamp: {
          DEFAULT: '#A32D2D',
          light: '#FCEBEB',
        },
        flag: {
          DEFAULT: '#854F0B',
          light: '#FAEEDA',
        },
        muted: '#5F6B68',
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
};