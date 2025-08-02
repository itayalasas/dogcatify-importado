#!/bin/sh
echo "$GOOGLE_SERVICES_JSON_BASE64" | base64 --decode > android/app/google-services.json
