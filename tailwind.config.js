/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent) / 0.15)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
      borderRadius: { xl2: '1.25rem' },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.34,1.56,.64,1)',
        out: 'cubic-bezier(.2,.8,.2,1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'fade-out': { from: { opacity: 1 }, to: { opacity: 0 } },
        'fade-soft': { from: { opacity: 0 }, to: { opacity: 1 } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.96) translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-in': { from: { opacity: 0, transform: 'translateX(32px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-out': { from: { opacity: 1, transform: 'none' }, to: { opacity: 0, transform: 'translateX(32px)' } },
        // no `filter` here: animating filter breaks backdrop-blur on glass (see .enter in styles.css)
        'rise-in': { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.4)', opacity: 0 }, '60%': { transform: 'scale(1.2)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        'toast-in': { from: { opacity: 0, transform: 'translateY(16px) scale(.95)' }, to: { opacity: 1, transform: 'none' } },
        'digit-in': { from: { opacity: 0, transform: 'translateY(-.25em)' }, to: { opacity: 1, transform: 'none' } },
        'soft-pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
      },
      animation: {
        'fade-in': 'fade-in .35s cubic-bezier(.2,.8,.2,1) both',
        'fade-out': 'fade-out .22s ease both',
        'fade-soft': 'fade-soft .3s ease both',
        'fade-slow': 'fade-soft .5s ease both',
        'scale-in': 'scale-in .28s cubic-bezier(.34,1.3,.64,1) both',
        'slide-in': 'slide-in .38s cubic-bezier(.2,.9,.2,1) both',
        'slide-out': 'slide-out .22s cubic-bezier(.4,0,1,1) both',
        // `backwards` so the element's own transforms (hover/drag scale) apply once it lands
        'rise-in': 'rise-in .7s cubic-bezier(.2,.8,.2,1) backwards',
        pop: 'pop .38s cubic-bezier(.34,1.56,.64,1) both',
        'toast-in': 'toast-in .35s cubic-bezier(.34,1.4,.64,1) both',
        'digit-in': 'digit-in .45s cubic-bezier(.2,.8,.2,1) both',
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
