# Contributing

Use Node 24.x (>=24.22), run `npm ci`, and keep package-lock.json in sync. Start each app independently as described in README.

Before a pull request run `npm run check`, `npm run check:release`, `npm run build`, and `npm run speaking:build`. Tests should use temporary private-config paths and mocked provider responses, never a contributor's real Key. Exercise desktop recording manually after audio changes.

Keep the two app data stores independent. AI credentials must remain outside study backups and browser storage. All human-facing answer/report exports must remain readable PDF documents. Preserve Inspera-style examination layouts and current purple/lavender learning UI.

Add only content you may redistribute under a compatible license, with attribution. Do not attach proprietary IELTS materials, downloaded media, third-party fonts without a license, customer conversations or test recordings. If adding an original demo, label it as a demonstration rather than an official exam question.
