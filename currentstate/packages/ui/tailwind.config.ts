import type { Config } from "tailwindcss";

// Tailwind-пресет дизайн-токенов PrismMTR (Glassmorphism).
const prismUiPreset: Pick<Config, "theme" | "plugins" | "darkMode"> = {
  darkMode: ["class"],
  theme: {
    extend: {
      // Ключевые токены из old-website/css/main.css.
      colors: {
        "prism-accent": "var(--color-accent)",
        glass: "var(--glass-bg)",
      },
      borderColor: {
        glass: "var(--glass-border)",
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
      },
      boxShadow: {
        // Свечение акцентного цвета.
        glow: "0 0 40px rgba(37, 99, 235, 0.3)",
        // Лёгкая стеклянная тень.
        glass: "0 8px 32px rgba(0, 0, 0, 0.08)",
      },
      borderRadius: {
        glass: "16px",
      },
    },
  },
  plugins: [],
};

export default prismUiPreset;
export { prismUiPreset };
