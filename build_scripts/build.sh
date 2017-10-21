#!/bin/bash

set -e

if [ "$CI_BRANCH" = "develop" ] || [ "$CI_BRANCH" = "master" ]; then
  curl "https://docs.google.com/document/d/1J09YjR3XaQqu1gIu1Oyz1lpRjr73NThK_fGb8D3wmsU/export?format=pdf" > public/data/ChicagoScannerGuide.pdf
  if [ "$CI_BRANCH" = "master" ]; then
    ember build --environment=production
    firebase deploy --project crimeisdown --token $FIREBASE_TOKEN
  fi
  if [ "$CI_BRANCH" = "develop" ]; then
    ember build
    firebase deploy --project crimeisdown-dev --token $FIREBASE_TOKEN
  fi
fi
