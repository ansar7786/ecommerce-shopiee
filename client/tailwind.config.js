/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F0FDF4',
          DEFAULT: '#15803D',
          600: '#15803D',
          700: '#166534',
        },
        accent: {
          DEFAULT: '#F59E0B',
          500: '#F59E0B',
          600: '#D97706',
        },
        ink: {
          900: '#111827',
          600: '#4B5563',
          300: '#D1D5DB',
        },
        danger: {
          50: '#FEF2F2',
          DEFAULT: '#DC2626',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF',
          DEFAULT: '#2563EB',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        page: '#F9FAFB',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Telugu"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        card: '16px',
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [],
};
