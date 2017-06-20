#!/bin/bash
set -e

[[ -s $HOME/.nvm/nvm.sh ]] && . $HOME/.nvm/nvm.sh  # This loads NVM
nvm install 6
npm install -g ember-cli
npm install -g yarn
# npm install -g bower
# bower install
yarn
