// PM2 ecosystem.
// F1 expone solo `api` + `worker` (dist/workers/index.js).
// F2 (email), F3 (notificaciones) y F4 (recs) agregan sus propias apps aqui.
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/api.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
    {
      name: 'worker',
      script: 'dist/workers/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // BullMQ drena el job en curso antes de salir.
      kill_timeout: 30000,
      listen_timeout: 10000,
    },
    {
      // F2: procesa email-critical / email-transactional / email-marketing.
      name: 'worker-email',
      script: 'dist/workers/emailWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: 'logs/worker-email-error.log',
      out_file: 'logs/worker-email-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // BullMQ drena el job en curso antes de salir.
      kill_timeout: 30000,
      listen_timeout: 10000,
    },
    {
      // F3: procesa notification-fanout / notification-inapp.
      name: 'worker-notifications',
      script: 'dist/workers/notificationWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: 'logs/worker-notifications-error.log',
      out_file: 'logs/worker-notifications-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // BullMQ drena el job en curso antes de salir.
      kill_timeout: 30000,
      listen_timeout: 10000,
    },
  ],
};
