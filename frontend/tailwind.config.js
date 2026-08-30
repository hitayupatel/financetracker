/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Aurelian Finance — tonal spot palette (light)
        surface: {
          DEFAULT: '#f9f9fe',
          dim: '#d7dae4',
          bright: '#f9f9fe',
          lowest: '#ffffff',
          low: '#f2f3fb',
          container: '#ecedf6',
          high: '#e6e8f1',
          highest: '#dfe2ed',
          variant: '#dfe2ed',
        },
        content: {
          DEFAULT: '#2f323b',
          variant: '#5b5f68',
          inverse: '#9c9ca2',
        },
        outline: {
          DEFAULT: '#777b84',
          variant: '#aeb2bc',
        },
        primary: {
          DEFAULT: '#4c5e8b',
          dim: '#40527f',
          on: '#f9f8ff',
          container: '#b6c8fc',
          'on-container': '#2e416c',
        },
        secondary: {
          DEFAULT: '#585f72',
          dim: '#4c5366',
          on: '#f9f8ff',
          container: '#dbe2f9',
          'on-container': '#4a5164',
        },
        tertiary: {
          DEFAULT: '#6b5680',
          dim: '#5f4b73',
          on: '#fff6ff',
          container: '#e7cdfe',
          'on-container': '#56426a',
        },
        danger: {
          DEFAULT: '#a83836',
          dim: '#67040d',
          on: '#fff7f6',
          container: '#fa746f',
          'on-container': '#6e0a12',
        },
        positive: '#2e7d5b',
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        'level-1': '0px 4px 20px rgba(76, 94, 139, 0.06)',
        'level-2': '0px 12px 32px rgba(76, 94, 139, 0.12)',
      },
      maxWidth: {
        content: '1440px',
      },
    },
  },
  plugins: [],
}
