/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: "var(--border)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        status: {
          synced: "var(--status-synced)",
          ahead: "var(--status-ahead)",
          behind: "var(--status-behind)",
          diverged: "var(--status-diverged)",
          updating: "var(--status-updating)",
          error: "var(--status-error)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      animation: {
        shimmer: "shimmer 1.5s infinite linear",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-down": "slideDown 0.25s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-48px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      boxShadow: {
        focus: "var(--focus-glow)",
        card: "0 1px 3px rgba(0,0,0,0.5)",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
