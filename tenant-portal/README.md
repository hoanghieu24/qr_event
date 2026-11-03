# Tenant event portal

This is the separate event management and QR check-in web app for tenant managers and their event staff.

## Local development

1. Start the backend API and MySQL database.
2. Run the tenant schema migration from `backend`: `npm run migrate:v4`, followed by `npm run migrate:v5`.
3. In `tenant-portal`, copy `.env.example` to `.env` and set `VITE_API_URL` to the backend API URL if it differs from `http://localhost:5000/api/v1`.
4. Run `npm install`, then `npm run dev`. Vite serves this app on port `5174` and proxies local API calls to port `5000`.

The platform admin manages tenant accounts and event packages in the main admin app. Each tenant account gets three trial events, using limits from the active package marked “trial.” Each paid package covers one event and sets its attendee, employee, referrer, and ticket-checker limits. The tenant requests a package, the platform admin confirms payment, and the tenant then uses that package to create one event. Closing an event keeps its data and does not restore the trial event or package.

After migrating, the platform admin needs to create and activate one zero-price trial package before tenant accounts can create their three trial events. Existing credit-based packages are hidden from sale by the V5 migration; update them to per-event limits before reactivating them.

The package request flow is manual. No payment gateway is connected yet.

For production, deploy this app on its own domain, set `VITE_API_URL` to the public backend API URL, and set `VITE_TENANT_PORTAL_URL` in the main frontend so its login page links to this domain. Camera scanning requires HTTPS in production (localhost is allowed for local development).
