// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const env = loadEnv("development", process.cwd(), "");
const supabaseUrl = env.VITE_SUPABASE_URL ?? "https://qmnienngwksbeiyczrka.supabase.co";
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ezbgBF6s8NL_XAAowb4v6A_1APP0Ado";
const supabaseProjectId = env.VITE_SUPABASE_PROJECT_ID ?? "qmnienngwksbeiyczrka";

export default defineConfig({
  vite: {
    optimizeDeps: {
      exclude: ["@tanstack/react-start"],
    },
    server: {
      // Túneis públicos (ex.: Cloudflare Quick Tunnel) usados para receber
      // webhooks de provedores enquanto o sistema roda localmente. O hostname
      // do túnel é aleatório a cada execução, então liberamos o domínio
      // inteiro em vez de um host fixo. Não afeta produção.
      //
      // dev.zapapi.tech: ambiente de DESENVOLVIMENTO na VPS (2.24.95.54),
      // acessado pelo Traefik. Sem esta entrada o Vite responde 403
      // ("This host is not allowed") porque o proxy entrega o Host público.
      allowedHosts: [".trycloudflare.com", "dev.zapapi.tech"],
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
