#!/bin/bash

set -e

curl "https://docs.google.com/document/d/1J09YjR3XaQqu1gIu1Oyz1lpRjr73NThK_fGb8D3wmsU/export?format=pdf" > public/data/ChicagoScannerGuide.pdf

if [ "$CI_BRANCH" = "master" ]; then
  ember build --environment=production
else
  ember build
fi
