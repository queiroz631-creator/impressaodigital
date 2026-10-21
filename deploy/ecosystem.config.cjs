// Configuração do PM2 — mantém a aplicação e o worker rodando na VPS.
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
      node_args: require("node:fs").existsSync("/etc/impressaodigital/qz.env")
        ? "--env-file=.env --env-file=/etc/impressaodigital/qz.env"
        : "--env-file=.env",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "127.0.0.1",
      },
    },
    {
      name: "agentes-worker",
      // Worker da Central de Agentes — processa tarefas da fila
      script: ".output/server/index.mjs", // Mesmo build; entry point definido via WORKER_ENTRYPOINT
      cwd: `${__dirname}/..`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      // Variáveis específicas do worker
      node_args: require("node:fs").existsSync("/etc/impressaodigital/qz.env")
        ? "--env-file=.env --env-file=/etc/impressaodigital/qz.env"
        : "--env-file=.env",
      env: {
        NODE_ENV: "production",
        WORKER_ENTRYPOINT: "true", // Sinaliza ao build para incluir worker
        WORKER_POLL_INTERVAL_MS: "5000",
        WORKER_MAX_TAREFAS: "10",
        WORKER_LEASE_SEGUNDOS: "60",
        WORKER_HEARTBEAT_INTERVAL_MS: "10000",
        WORKER_LOG_LEVEL: "info",
      },
    },
  ],
};
