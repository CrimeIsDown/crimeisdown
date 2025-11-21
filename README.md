# crimeisdown

This README outlines the details of collaborating on this Ember application.
A short introduction of this app could easily go here.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) (with npm)
* [Ember CLI](https://cli.emberjs.com/release/)
* [Google Chrome](https://google.com/chrome/)

## Installation

* `git clone <repository-url>` this repository
* `cd crimeisdown`
* `npm install`

## Running / Development

* `npm run start`
* Visit your app at [http://localhost:4200](http://localhost:4200).
* Visit your tests at [http://localhost:4200/tests](http://localhost:4200/tests).

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `npm run test`
* `npm run test:ember -- --server`

### Linting

* `npm run lint`
* `npm run lint:fix`

### Building

* `npm exec ember build` (development)
* `npm run build` (production)

### Deploying

Deployments are handled by Cloudflare Pages via `.github/workflows/cloudflare-pages.yml`:

* Pushes to `main` or `master` run `npm run build` and upload the `dist/` directory to the Cloudflare Pages project named `crimeisdown`.
* Pull requests from the main repository generate preview deployments so changes can be verified before merge.
* Define the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` repository secrets with credentials that have Cloudflare Pages access.
* The `_headers` and `_redirects` files in `public/` control global headers and SPA-style routing during the Ember build.

## Further Reading / Useful Links

* [ember.js](https://emberjs.com/)
* [ember-cli](https://cli.emberjs.com/release/)
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)
