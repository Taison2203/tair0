# Frontend publishing

The live entry point is /index.html at https://tair0.me/. Public assets, CSS and modules are served from /assets/, /css/ and /js/.

The old /papers-portfolio/ and /Tair.site/papers-portfolio/ entry pages redirect to / while preserving the query and fragment. Keep these redirects in place during future updates.

To synchronise a complete frontend source directory into this checkout, run:

    node scripts/sync-github-pages.mjs <frontend-source-directory> <this-checkout>

Only public frontend directories and entry pages are copied. Commit and push the resulting changes to publish through GitHub Pages. CNAME and .nojekyll must remain in the repository root.
