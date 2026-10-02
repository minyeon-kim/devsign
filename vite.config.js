import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: "/devsign/",
  // The i18n JSX runtime is app source, so it's addressed by a root path:
  // as "@/i18n" Vite took it for a package and pre-bundled it, giving it a
  // frozen copy of the Korean dictionary and its own language store — new
  // ko.js entries never reached JSX text/attributes in dev, and switching
  // language in Settings didn't re-render them.
  plugins: [react({ jsxImportSource: "/src/i18n" }), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
