import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: 'rgb(255 249 244 / <alpha-value>)',
        sand: 'rgb(243 235 227 / <alpha-value>)',
        'sand-deep': 'rgb(233 222 210 / <alpha-value>)',
        ink: 'rgb(24 23 22 / <alpha-value>)',
        'ink-soft': 'rgb(74 70 66 / <alpha-value>)',
        'ink-faint': 'rgb(116 108 100 / <alpha-value>)',
        accent: 'rgb(244 91 61 / <alpha-value>)',
        'accent-deep': 'rgb(198 63 37 / <alpha-value>)',
        herb: 'rgb(63 118 82 / <alpha-value>)',
        line: 'rgb(234 223 212 / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
