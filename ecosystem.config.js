module.exports = {
  apps: [{
    name: 'minhas-financas-api',
    script: './dist/server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3333
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false,
    // Restart automaticamente em caso de falha
    max_restarts: 10,
    min_uptime: '10s',
    // Delay entre restarts
    restart_delay: 4000
  }]
};
