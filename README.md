# EdgeGist

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/icons/edgegist-dark-192.png">
    <img src="public/icons/edgegist-192.png" alt="EdgeGist app icon" width="96" height="96">
  </picture>
</p>

[简体中文](README.zh-CN.md)

Minimal GitHub Gist-compatible API service running on Cloudflare's edge network, backed by D1 and packaged for Cloudflare Pages.

Works perfectly with the [Sub-Store](https://github.com/sub-store-org/Sub-Store) Gist sharing and backup features.

EdgeGist is API-first: deploy it, configure your owner token, and point Gist API clients at your own base URL instead of `https://api.github.com`. It also ships a single-owner Web UI at `/<owner>` for browsing, editing, import/export, and Cloudflare usage checks. The root path `/` intentionally returns `404` instead of redirecting, so the configured owner route is not exposed.

## Community

Join the community for discussion and updates.

👥 Group [折腾啥](https://t.me/zhetengsha_group) · 📢 Channel [折腾啥](https://t.me/zhetengsha)

## Screenshots

The Web UI supports English and Simplified Chinese. The screenshots below use Simplified Chinese so the project only needs to maintain one screenshot set.

<table>
  <tr>
    <td width="50%" valign="top" align="center">
      <img src="screenshots/readme/list.png" alt="Gist list with search, filters, pagination, stars, and highlighted content matches" width="100%">
      <br>
      <sub>Server-side search across ids, descriptions, filenames, and file contents, with filters, sorting, pagination, stars, and syntax-highlighted content matches.</sub>
    </td>
    <td width="50%" valign="top" align="center">
      <img src="screenshots/readme/detail.png" alt="Wide gist detail dashboard with file tree, diff view, and history panels" width="100%">
      <br>
      <sub>Responsive gist detail dashboard with a file tree, syntax-highlighted content, file history, file-set changes, and configurable diffs.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top" align="center">
      <img src="screenshots/readme/diff.png" alt="Compact gist detail diff view with split layout and diff controls" width="100%">
      <br>
      <sub>Diff view with current and revision raw URLs, automatic/split/unified/stacked layouts, inline-change modes, line wrapping, line numbers, backgrounds, and collapsible unchanged lines.</sub>
    </td>
    <td width="50%" valign="top" align="center">
      <img src="screenshots/readme/usage.png" alt="Cloudflare usage and quota dashboard on a compact viewport" width="100%">
      <br>
      <sub>Cached and refreshable Cloudflare Pages Functions, Pages build, D1 row, and D1 storage usage.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top" align="center">
      <img src="screenshots/readme/login.png" alt="Owner login with username, password, remember-me, and Cloudflare Turnstile" width="100%">
      <br>
      <sub>Owner login with username/password, optional remember-me, and optional Cloudflare Turnstile.</sub>
    </td>
    <td width="50%" valign="top"></td>
  </tr>
</table>

## Current Scope

- GitHub Gist-shaped API for core gist CRUD and retained revisions.
- Single-owner authentication: bearer token for API clients, password + optional Turnstile + signed cookie for the Web UI.
- Public and secret-link visibility handling. Secret gists are hidden from anonymous list APIs but remain readable by direct URL; retained revisions follow the current gist visibility.
- D1-backed current files, retained history snapshots, and settings.
- Latest-N history retention for each file and each gist's file-change feed.
- GitHub Gist-style Web UI at `/<owner>`, `/<owner>/new`, `/<owner>/<gist_id>`, and `/<owner>/<gist_id>/<sha>` with anonymous public browsing, owner management, gist editing, file history, diff view, stars, import/export, i18n, themes, PWA install support, and Cloudflare usage/quota views.
- Root `/` returns `404` and does not redirect to the owner route. Anonymous users need to know `/<owner>` to browse public gists.
- Real single-owner star support; fork and comment surfaces remain compatibility mocks with zero social data.
- Release packaging for Cloudflare Pages, including Direct Upload zips.

Not in the first implementation: git repository transport, multi-user collaboration, and real social features.

## API Behavior Notes

- Owner API clients should send `Authorization: Bearer <EDGEGIST_OWNER_TOKEN>`.
- Anonymous list APIs return `public` gists only. `secret` gists are omitted from anonymous lists but can still be read anonymously when the caller knows the URL or gist id.
- Retained revisions do not have separate visibility. If the current gist is readable by direct URL, its retained revisions are readable by direct URL.
- `PATCH /gists/{gist_id}` treats `null`, empty content, and an empty file spec as file deletion. Deleting every file deletes the gist.
- Raw file endpoints serve content as `text/plain` with `nosniff`, so HTML gist files are shown as inert text.

## Development

Requirements: Bun and Node.js 22 or newer. This repository includes `.node-version` because Wrangler requires a modern Node runtime. If you use mise, run `mise install` once and your shell will pick up the project Node version automatically when you enter the repository.

```sh
bun install
bun run dev
```

`bun run dev` prepares the local environment, applies local D1 migrations, and starts the API at `http://127.0.0.1:8787/` and the Web UI at `http://127.0.0.1:8787/<owner>`. Root `/` returns `404` by design.

On first run it will:

- create `wrangler.jsonc` from `wrangler.example.jsonc` when missing;
- create or append `.dev.vars` with local development defaults;
- set `EDGEGIST_BASE_URL` to `http://127.0.0.1:8787`;
- skip Turnstile on localhost/loopback dev hosts even if Turnstile keys are configured;
- persist local D1 data under `.wrangler/state/v3`.

Useful development commands:

```sh
bun run dev:prepare
bun run dev:server
bun run test
bun run build
```

Use `bun run dev:prepare` when you only want to create local config and apply local D1 migrations. Use `bun run dev:server` when local D1 is already prepared and you only want to restart the server. `bun run build` creates the client assets and Cloudflare Pages worker under `dist/`.

If you used an older development build before the schema stabilized and local D1 starts failing, delete `.wrangler/state/v3` and run `bun run dev:prepare` again. EdgeGist keeps source migrations clean for new installs and does not carry compatibility migrations for stale development data.

## Configuration

Tracked configuration lives in example files. Your real deployment config is ignored by git.

```sh
cp wrangler.example.jsonc wrangler.jsonc
```

Edit `wrangler.jsonc`:

- `name`: Cloudflare Pages project name.
- `EDGEGIST_OWNER_USERNAME`: owner login shown in API responses.
- `EDGEGIST_OWNER_PASSWORD`: password for the owner web UI at `/<owner>`.
- `EDGEGIST_OWNER_TOKEN`: token used by Gist API clients in `Authorization: Bearer ...`.
- `EDGEGIST_BASE_URL`: your deployed URL.
- `EDGEGIST_HISTORY_MAX_VERSIONS`: keep this many latest history entries for each file and this many latest file-change records for each gist. Defaults to `100`.
- `EDGEGIST_TURNSTILE_SITE_KEY` and `EDGEGIST_TURNSTILE_SECRET_KEY`: optional Cloudflare Turnstile keys for protecting the owner login form. Configure both values together, or leave both empty to disable Turnstile.
- `database_id`: D1 database id created in Cloudflare.

Do not commit `wrangler.jsonc` or `.dev.vars`.

History retention:

```jsonc
"EDGEGIST_HISTORY_MAX_VERSIONS": "100"
```

Security defaults:

- EdgeGist sends `X-Robots-Tag: noindex, nofollow, noarchive`, includes a `robots` meta tag, and ships `robots.txt` with `Disallow: /` to prevent search engines from indexing public, secret-link, raw, and Web UI pages.
- Root `/` returns `404` instead of redirecting to `/<owner>`, so visitors do not learn the configured owner username from the landing URL.
- Turnstile is optional. Create a Turnstile widget in the Cloudflare dashboard, add the site key and secret key to the two environment variables above, then redeploy. EdgeGist renders the widget on the owner login form, validates the token server-side with Cloudflare Siteverify before checking username and password, then uses a signed session cookie for the owner UI. Bearer owner tokens still work for API clients. Local development requests served from `localhost`, `127.0.0.1`, `0.0.0.0`, or `[::1]` always skip Turnstile so the owner UI remains usable offline and without a localhost Turnstile widget.

PWA behavior:

- The install manifest is served from `/<owner>/manifest.webmanifest`, with `start_url` and `scope` limited to `/<owner>`.
- The service worker is served from `/<owner>/edgegist-sw` and only caches static app assets and icons. It does not cache API responses, raw file content, or rendered gist pages.

## Command-Line Deployment

Requirements: Bun, Wrangler, and a Cloudflare account.

```sh
bun install
bun run db:create
```

This creates a Cloudflare D1 database named `edge-gist`. Copy the created D1 database id into `wrangler.jsonc`, then deploy:

```sh
bun run db:migrate:remote
bun run build
bun run deploy
```

Use your deployed Pages URL as the Gist API base URL and `EDGEGIST_OWNER_TOKEN` as the token.

## Manual Cloudflare Deployment

Use this path if you cannot build locally.

1. Open the latest GitHub Release.
2. Download `edgegist-upload.zip` and `edgegist-package.zip`.
3. In Cloudflare Dashboard, open D1 and create a database named `edge-gist`.
4. Open the new D1 database console, copy every SQL file under `migrations/` from `edgegist-package.zip`, and run them in filename order.
5. Create a Cloudflare Pages project with Direct Upload and upload `edgegist-upload.zip`.
6. In Pages settings, add the environment variables listed above.
7. In Pages Functions settings, add a D1 binding with variable name `DB` and select the `edge-gist` database.
8. Redeploy the latest upload if Cloudflare asks for a new deployment after settings changes.

## AI-Assisted Deployment

Use this path if you want an AI coding agent to deploy from your local checkout.

1. Tell the agent your Cloudflare Pages project name, owner username, and final base URL or custom domain.
2. Ask the agent to generate `EDGEGIST_OWNER_TOKEN` and `EDGEGIST_OWNER_PASSWORD`, or provide your own values.
3. Let the agent run `wrangler login`; complete the Cloudflare browser authorization yourself.
4. Let the agent create the `edge-gist` D1 database, write `wrangler.jsonc`, apply migrations, build, deploy, and verify `/<owner>`.
5. If you use a custom domain, add it in Cloudflare Pages and point DNS to the Pages project.

Do not send Cloudflare account passwords to an AI agent. Use Wrangler OAuth login or a narrowly scoped Cloudflare API token.

### Cloudflare Account API Token For Deployment

Wrangler can deploy with OAuth login, or with `CLOUDFLARE_API_TOKEN`. For a durable deployment credential, use an Account API token instead of a User API token. Account API tokens are owned by the Cloudflare account and are better suited for CI/CD and long-lived integrations.

To create a token for deployment:

1. Open Cloudflare Dashboard > Manage Account > Account API Tokens.
2. Select Create Token.
3. Name it, for example `edge-gist-deploy`.
4. Add permission `Account` > `Cloudflare Pages` > `Edit`.
5. Under Account Resources, select only the account that owns the `edge-gist` Pages project.
6. Continue to summary, create the token, and copy it once.

Use it only as an environment variable when deploying:

```sh
CLOUDFLARE_API_TOKEN=<token> bun run deploy
```

For CI, also set `CLOUDFLARE_ACCOUNT_ID` to the same account ID.

## Usage And Quota

The owner Web UI at `/<owner>` can show Cloudflare Pages and D1 usage after you save Cloudflare settings in the Usage and quota page. These settings are stored in EdgeGist's D1 `settings` table under the `cloudflare` key. The API token is write-only from the browser's point of view; the owner settings API returns only `hasApiToken`.

Usage data is cached in the D1 `settings` table under the `cloudflare_usage_cache` key. Opening the Usage and quota page shows cached data when available. The UI also has an auto-refresh toggle that fetches fresh Cloudflare data once when you enter the page.

The Data page exports and imports all owner gist data and all rows in the D1 `settings` table. Import replaces the current EdgeGist data set. Treat export files as sensitive because saved settings can include Cloudflare API tokens.

Use an Account API token here as well. Pages, D1, and Account Analytics are compatible with Account API tokens, and the token can keep working even if an individual user leaves the account.

To create the Cloudflare API token used by this page:

1. Open Cloudflare Dashboard > Manage Account > Account API Tokens.
2. Select Create Token.
3. Name it, for example `edge-gist-usage`.
4. Add permissions:
   - `Account` > `Cloudflare Pages` > `Read`
   - `Account` > `D1` > `Read`
   - `Account` > `Account Analytics` > `Read`
5. Under Account Resources, select only the account that owns the Pages project and D1 database.
6. Create the token and paste it into `/<owner>` > Usage and quota > API token.

If you want one token to both deploy and read usage, use `Cloudflare Pages: Edit` instead of `Read`. If you also want to run D1 migrations with the same token, use `D1: Edit` instead of `Read`.

Cloudflare settings fields:

- `Account ID`: Cloudflare account ID. It is used for all Cloudflare REST and GraphQL API calls.
- `API token`: a Cloudflare API token with read access to the Pages project, D1 database, and account analytics/GraphQL data used by the dashboard. Leave this field blank when editing if you want to keep the saved token.
- `Pages project`: the Cloudflare Pages project name, the same project slug used by `wrangler pages deploy --project-name`.
- `D1 database ID`: the D1 database UUID. You can get it from the D1 dashboard or `wrangler d1 info edge-gist`.
- `Pages plan`: selects the official Pages quota table used for `Builds this month`.
- `Workers/D1 plan`: selects the official D1 quota table and Workers request quota window. Free uses daily row quotas and daily Workers request usage; Paid uses monthly included row quotas and monthly Workers request usage.

Usage fields and sources:

- `Updated at`: the time EdgeGist last fetched and cached Cloudflare usage data.
- `Project`, `Production branch`, `Functions`, `Functions script`, and `Latest deployment`: Cloudflare REST API `GET /accounts/{account_id}/pages/projects/{project_name}`.
- `Today’s requests` / `This month’s requests`: Cloudflare GraphQL Analytics API using `pagesFunctionsInvocationsAdaptiveGroups` filtered by the Pages project `production_script_name`. This matches the Workers & Pages quota card because Pages Functions requests count toward Workers request usage. Workers Free uses `100,000` requests/day; Workers Paid shows the `10,000,000` monthly included requests.
- `Builds this month`: Cloudflare REST API `GET /accounts/{account_id}/pages/projects/{project_name}/deployments`, counted for the current UTC month. Limits come from the Cloudflare Pages limits table: Free `500`, Pro `5,000`, Business `20,000`, Enterprise shows no fixed monthly build limit.
- `Database`: Cloudflare REST API `GET /accounts/{account_id}/d1/database/{database_id}`.
- `Usage window`: Free D1 shows the current UTC day; Paid D1 shows the current UTC month, matching the quota periods in Cloudflare D1 pricing.
- `Read queries`, `Write queries`, `Rows read`, `Rows written`, and `Database size`: Cloudflare GraphQL Analytics API using `d1AnalyticsAdaptiveGroups` and `d1StorageAdaptiveGroups`. D1 analytics are retained for the past 31 days.
- `Rows read` and `Rows written` limits: Cloudflare D1 pricing, Free `5,000,000` rows read/day and `100,000` rows written/day, Paid `25,000,000,000` rows read/month included and `50,000,000` rows written/month included.
- `Database size` limit: Cloudflare D1 per-database limits, Free `500 MB`, Workers Paid `10 GB`.

Official references: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Cloudflare Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Cloudflare Workers GraphQL metrics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/), [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/), and [Cloudflare D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/).

## Updating

Command-line users:

```sh
git pull
bun install --frozen-lockfile
bun run db:migrate:remote
bun run build
bun run deploy
```

Manual users:

1. Download the new `edgegist-upload.zip` from GitHub Releases.
2. If the release notes mention migrations, copy the new SQL from `edgegist-package.zip` and run it in the D1 console.
3. Upload the new `edgegist-upload.zip` to the same Cloudflare Pages project.
4. Keep your existing environment variables and D1 binding unless release notes say otherwise.

## GitHub Releases

Bump `package.json` version and merge or push that change to the default branch to cut a release. The Release workflow can also be run manually from GitHub Actions.

The workflow reads `package.json` for the package name and version, uses `v${version}` as the release tag, fails if that release already exists or if the tag points at a different commit, then runs tests, builds, packages, generates conventional release notes, creates the tag when needed, and publishes:

- `edgegist-upload.zip`: direct Cloudflare Pages dashboard upload. `_worker.js` is at the zip root.
- `edgegist-package.zip`: README files, migrations, example config, and build output.
- `SHA256SUMS`: checksums for release assets.

## API Compatibility

Supported GitHub Gist-compatible REST surface:

- `GET /gists`, `GET /gists/public`, and `GET /users/{username}/gists`.
- `POST /gists`, `GET /gists/{gist_id}`, `PATCH /gists/{gist_id}`, and `DELETE /gists/{gist_id}`.
- `GET /gists/{gist_id}/commits` and `GET /gists/{gist_id}/{sha}` for retained file revisions.
- Current raw files through `GET /gists/{gist_id}/raw/{filename}` and GitHub-style `GET /{owner}/{gist_id}/raw/{filename}`.
- Retained raw files through `GET /gists/{gist_id}/raw/{sha}/{filename}` and GitHub-style `GET /{owner}/{gist_id}/raw/{sha}/{filename}`.
- Star endpoints: `GET /gists/starred`, `GET /gists/{gist_id}/star`, `PUT /gists/{gist_id}/star`, and `DELETE /gists/{gist_id}/star`.

Compatibility mocks:

- `GET /gists/{gist_id}/comments`, comment mutation endpoints, and fork endpoints exist for client compatibility, but return empty or no-op responses.

Unsupported:

- Git transport (`git clone`, `git push`, `git pull` against a gist repository) is not implemented.

## Related Projects

- [LiteGist](https://github.com/lockcp/LiteGist)

  > LiteGist is an extremely lightweight, experience-focused personal standalone pastebin service. Designed with a full-screen editor philosophy, it supports Markdown rendering, code highlighting, password protection, Gist-compatible multi-file management, and PWA support. It aims to provide you with a high-performance "Private Gist" sharing experience.
