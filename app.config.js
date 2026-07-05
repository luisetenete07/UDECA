// Config dinámica: reutiliza app.json tal cual, pero permite fijar
// experiments.baseUrl solo cuando se compila específicamente para GitHub
// Pages (GHPAGES_BASE_URL=/App-calistenia), sin afectar al desarrollo local
// (npm start / npm run web) ni a las builds nativas.
module.exports = ({ config }) => ({
  expo: {
    ...config,
    ...(process.env.GHPAGES_BASE_URL
      ? {
          experiments: {
            ...config.experiments,
            baseUrl: process.env.GHPAGES_BASE_URL,
          },
        }
      : {}),
  },
});
