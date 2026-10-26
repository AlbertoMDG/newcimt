// pm2 config for the CIMT API (Express + static dist/)
// Start (elevated shell): pm2 start C:/web/newcimt/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'cimt-api',
      cwd: 'C:/web/newcimt/server',
      script: 'C:/web/newcimt/server/node_modules/tsx/dist/cli.mjs',
      args: 'src/index.ts',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
