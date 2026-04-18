import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--surface-default))",
        foreground: "hsl(var(--text-default))",
        card: "hsl(var(--surface-elevated))",
        "card-foreground": "hsl(var(--text-default))",
        border: "hsl(var(--border-default))",
        input: "hsl(var(--border-default))",
        ring: "hsl(var(--border-focus))",
        muted: "hsl(var(--surface-sunken))",
        "muted-foreground": "hsl(var(--text-muted))",
        primary: {
          DEFAULT: "hsl(var(--primary-default))",
          foreground: "hsl(var(--primary-foreground))"
        },
        success: {
          DEFAULT: "hsl(var(--success-default))",
          foreground: "hsl(var(--success-foreground))"
        },
        warning: {
          DEFAULT: "hsl(var(--warning-default))",
          foreground: "hsl(var(--warning-foreground))"
        },
        error: {
          DEFAULT: "hsl(var(--error-default))",
          foreground: "hsl(var(--error-foreground))"
        },
        info: {
          DEFAULT: "hsl(var(--info-default))",
          foreground: "hsl(var(--info-foreground))"
        },
        sidebar: "hsl(var(--surface-canvas))"
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)"
      },
      boxShadow: {
        surface: "var(--shadow-surface)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
