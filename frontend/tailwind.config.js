/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        space: {
          900: "#050816",
          800: "#07111F",
          700: "#0B1023",
          600: "#0F1429",
          500: "#1A1F35",
        },
        neon: {
          cyan: "#00F5FF",
          purple: "#7B61FF",
          pink: "#FF4FD8",
          green: "#00FFA3",
          yellow: "#FFD166",
          red: "#FF4D6D",
          blue: "#3B82F6",
        },
        glass: {
          border: "rgba(123, 97, 255, 0.15)",
          hover: "rgba(0, 245, 255, 0.2)",
          bg: "rgba(15, 20, 35, 0.8)",
        },
      },
      fontFamily: {
        display: ["Orbitron", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        glow: "0 0 30px rgba(139, 92, 246, 0.35)",
        "glow-green": "0 0 30px rgba(74, 222, 128, 0.35)",
        "glow-cyan": "0 0 30px rgba(0, 245, 255, 0.35)",
        "glow-purple": "0 0 30px rgba(123, 97, 255, 0.35)",
        "glow-pink": "0 0 30px rgba(255, 79, 216, 0.35)",
        "glow-lg": "0 0 60px rgba(0, 245, 255, 0.15)",
        inner: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        "speaking-pulse": "speakingPulse 1.2s ease-in-out infinite",
        "float": "floatBounce 4s ease-in-out infinite",
        "float-slow": "floatBounce 6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "glow-breathe": "glowBreathe 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        "spin-slower": "spin 12s linear infinite",
        "shimmer": "shimmerMove 1.8s ease-in-out infinite",
        "gradient-flow": "gradientFlow 4s ease infinite",
        "scanline": "scanlineMove 4s linear infinite",
        "border-spin": "neonBorderSpin 3s linear infinite",
        "counter-pop": "counterPop 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fadeIn 0.4s ease-out",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "orbit": "orbit 20s linear infinite",
        "orbit-slow": "orbit 30s linear infinite",
        "ripple": "ripple 0.6s ease-out",
        "typing-pulse": "typingPulse 1.2s ease-in-out infinite",
        "message-slide": "messageSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        speakingPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(74, 222, 128, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(74, 222, 128, 0.6)" },
        },
        neonBorderSpin: {
          "0%": { "--neon-angle": "0deg" },
          "100%": { "--neon-angle": "360deg" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(var(--orbit-radius, 80px)) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(var(--orbit-radius, 80px)) rotate(-360deg)" },
        },
        ripple: {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
        typingPulse: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        messageSlideIn: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        floatBounce: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        scanlineMove: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        counterPop: {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "out-smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
