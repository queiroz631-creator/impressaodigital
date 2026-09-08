// Configuração do PM2 — mantém a aplicação rodando na VPS.
module.exports = {
  apps: [
    {
      name: "impressaodigital",
      // Build de produção gerado por `NITRO_PRESET=node-server npm run build`
      script: ".output/server/index.mjs",
      cwd: `${__dirname}/..`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      // Carrega as variáveis do arquivo .env da raiz do projeto (Node 20.6+)
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "127.0.0.1",
      },
    },
  ],
};
