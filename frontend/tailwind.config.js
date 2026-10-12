/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0A0E11',
          elevated: '#11171D',
          card: '#161D24',
          cardHover: '#1D2630',
          inner: '#0E1318',
          border: 'rgba(255, 255, 255, 0.08)',
          borderSubtle: 'rgba(255, 255, 255, 0.05)',
          borderStrong: 'rgba(255, 255, 255, 0.15)',
        },
        lime: {
          primary: '#B4F038',
          hover: '#C4F84E',
          dim: 'rgba(180, 240, 56, 0.12)',
          dark: '#0A1803',
        },
        coral: {
          primary: '#FF6347',
          hover: '#FF7960',
          dim: 'rgba(255, 99, 71, 0.12)',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
