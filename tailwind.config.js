/** @type {import('tailwindcss').Config} */
export default {
  content: ["./client/index.html", "./client/src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080a0f",
        deep: "#0d111a",
        card: "#111621",
        "card-raised": "#151c28",
        gold: "#f5c518",
        amber: "#e8a000",
        danger: "#e63946",
        text: "#c8ccd6",
        muted: "#7a8499"
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        sans: ["DM Sans", "sans-serif"],
        serif: ["DM Serif Display", "serif"]
      },
      boxShadow: {
        soft: "0 24px 60px rgba(0,0,0,0.42)",
        glow: "0 0 40px rgba(245,197,24,0.14)"
      },
      backgroundImage: {
        "hero-ambient":
          "radial-gradient(ellipse 80% 60% at 65% 38%, rgba(245,197,24,0.08) 0%, transparent 68%), radial-gradient(ellipse 50% 80% at 92% 84%, rgba(230,57,70,0.08) 0%, transparent 60%), linear-gradient(160deg, #080a0f 0%, #0d111a 100%)"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(1.25)" }
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        }
      },
      animation: {
        "fade-up": "fadeUp 0.7s ease both",
        "pulse-soft": "pulseSoft 1.5s infinite",
        marquee: "marquee 25s linear infinite"
      }
    }
  },
  plugins: []
};
