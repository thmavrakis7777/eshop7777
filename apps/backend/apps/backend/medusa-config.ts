import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  // Fulfillment module needs to be declared explicitly the moment any custom
  // provider is added — Medusa does not merge custom providers into its own
  // defaults, so the built-in manual provider must be listed here too, or
  // the existing Standard/Express shipping options (which use it) break.
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "./src/modules/store-pickup",
            id: "store-pickup",
          },
        ],
      },
    },
    // Same rule as fulfillment above: the built-in local provider (used for
    // admin UI in-app notifications on the "feed" channel) must be listed
    // explicitly alongside the real email provider, or it's silently lost.
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
            options: { channels: ["feed"] },
          },
          {
            resolve: "@medusajs/medusa/notification-sendgrid",
            id: "sendgrid",
            options: {
              channels: ["email"],
              api_key: process.env.SENDGRID_API_KEY,
              from: process.env.SENDGRID_FROM_EMAIL,
            },
          },
        ],
      },
    },
    {
      resolve: "./src/modules/seo",
    },
    {
      resolve: "./src/modules/site-settings",
    },
    {
      resolve: "./src/modules/content-pages",
    },
    {
      resolve: "./src/modules/homepage-blocks",
    },
  ],
})
