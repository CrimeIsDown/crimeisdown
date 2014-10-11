CrimeIsDown.com
===========

[![Build Status](https://travis-ci.org/EricTendian/crimeisdown.svg)](https://travis-ci.org/EricTendian/crimeisdown)

CrimeIsDown.com takes the confusion out of monitoring Chicago crime with data-driven tools. This is the code that is powering the website, where the tools will live (tools may be stored in a separate repository as they are developed).

## Getting started

1. Clone the repository
2. Ensure you have [Node.js](http://nodejs.org/), NPM (Node Package Manager), [Bower](http://bower.io/), [Karma](http://karma-runner.github.io/), and [Gulp.js](http://gulpjs.com/) installed globally.
3. In the root of the repostiory, run the following commands:

```shell
npm install
bower install
gulp
```

4. This should install all the necessary packages and generate a folder called `/dist` which contains the compiled HTML, CSS, and JS needed to make the website work. The contents of this `/dist` folder can be uploaded to a web server and viewed. To edit the website and view the changes instantly, use the command `gulp serve` instead of the standard `gulp` command. See the client-side documentation below for a full list of Gulp tasks.

## Server-side

No server-side technologies are being used currently. An API that interacts with some datasets from the [City of Chicago Data Portal](https://data.cityofchicago.org/) is planned. This may be developed in a separate repository.

## Client-side

The original project structure and development tool configuration was made possible by the [Yeoman generator for AngularJS with Gulp.js](https://github.com/Swiip/generator-gulp-angular) and has been modified for the purposes of this website.

### Directory structure

    /
    |-app        # Application goes here (index.html, 404.html)
    |---images   # Static images used inside the app
    |---partials # AngularJS partial templates
    |---public   # Files to be copied over to the root of /dist
    |---scripts  # Various JavaScript files to be loaded (mainly AngularJS)
    |-----home   # JavaScript being used on the Home partial view
    |---styles   # SCSS being used in the application, in main.scss for app stylesheets and vendor.scss for vendor stylesheets
    |-dist       # Where the files go after being compiled
    |---images   # Compressed versions of images in /app/images
    |---scripts  # Compiled, minified scripts used in application (both original and vendor JS)
    |---styles   # Compiled SCSS from /app/styles
    |-gulp       # Gulp.js tasks called by the "gulp" command
    |-test       # JavaScript tests should go here (currently just defaults from Yeoman generator)
    |---e2e      # Protractor end-to-end tests
    |---unit     # Karma unit tests

### Use Gulp tasks to "compile" the website

These Gulp.js tasks were included in the Yeoman generator listed above. More may be added as the need arises.

  * `gulp` or `gulp build` to build an optimized version of your application in `/dist`
  * `gulp serve` to launch a browser sync server on your source files
  * `gulp serve:dist` to launch a server on your optimized application
  * `gulp wiredep` to fill bower dependencies in your `.html` file(s)
  * `gulp test` to launch your unit tests with Karma
  * `gulp protractor` to launch your e2e tests with Protractor
  * `gulp protractor:dist` to launch your e2e tests with Protractor on the dist files

Other client-side technologies currently being used include:

  * SCSS split up into separate files in the `app/styles` folder, compiled in a Gulp.js task
  * AngularJS
  * Yahoo! YUI 3.0 CSS Reset, included in `app/styles/vendor.scss`
  * More technologies not listed in this README yet

## Contributing

To be decided in a new CONTRIBUTING.md file. Stay tuned for further information.

## Changelog and versioning

Various releases of this website and the tools under it will make use of the [Semantic Versioning guidelines.](http://semver.org/) There may be some errors in protocol, but generally we try to adhere to this.

Releases should be numbered with the format of `<major>.<minor>.<patch>`. What is defined as a "major", "minor", or "patch" release has yet to be decided.

### 0.1.0

* Finished single-page website with multimedia

### 0.0.1

* Initial release, with a draft of single-page website (idea pitch site)

## License

To be decided. Currently all code is under standard copyright law, except where any third-party material is used, in which the license of that material would apply.
