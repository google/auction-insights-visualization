#!/bin/bash
# Copyright 2020 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
set -euo pipefail

# Enter the name of your Cloud Storage bucket here. Do not use the prefix gs://
# or any trailing slashes, only the name of the bucket (e.g. "test-bucket").
export CLOUD_STORAGE_BUCKET=""

if [ "$CLOUD_STORAGE_BUCKET" = "" ]; then
  echo "CLOUD_STORAGE_BUCKET not set. Please fill it in and try again."
  exit 1
fi

# Download the dependencies in this directory. The directory itself won't be
# uploaded but will be used to compile the final JavaScript file.
mkdir -p deps

if ! [ -f deps/dscc.min.js ]; then
  curl -o deps/dscc.min.js https://raw.githubusercontent.com/googledatastudio/tooling/febb9a4d467a56ea4ca223a61618d82c4de507d3/packages/ds-component/_bundles/dscc.min.js
fi

if ! [ -f deps/moment.min.js ]; then
  curl -o deps/moment.min.js https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.27.0/moment.min.js
fi

if ! [ -f deps/chart.min.js ]; then
  curl -o deps/chart.min.js https://cdn.jsdelivr.net/npm/chart.js@2.9.3
fi

# Combine the dependencies with the custom code and write to aiViz.js.
cat deps/dscc.min.js > aiViz.js
echo >> aiViz.js
cat deps/moment.min.js >> aiViz.js
echo >> aiViz.js
cat deps/chart.min.js >> aiViz.js
echo >> aiViz.js
cat aiVizSource.js >> aiViz.js

# We don't have any custom CSS, so we just create an empty CSS file.
touch aiViz.css

# Replace the variable $CLOUD_STORAGE_BUCKET in the manifest file.
sed 's/$CLOUD_STORAGE_BUCKET/'$CLOUD_STORAGE_BUCKET'/g' manifest-template.json > manifest.json

# Upload all the files to Cloud Storage using `gsutil`.
gsutil cp -a public-read manifest.json gs://$CLOUD_STORAGE_BUCKET
gsutil cp -a public-read aiViz.* gs://$CLOUD_STORAGE_BUCKET
