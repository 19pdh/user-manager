#!/bin/bash
# USAGE:
# ./utils/updateSheets.sh sheets.json [VERSION_TAG]
#
# The sheets.json should be as provided in utils/example.sheets.json
# Value of parentId is Google Sheet ID, and scriptId is script id
# from Extensions > Apps Script.
# To learn more visit: https://github.com/google/clasp

FILE="$1"
TAG="$2"
DATE=$(date +"%Y-%m-%d %H:%M")

if [ -z "$FILE" ]; then
	echo "USAGE: 
  updateSheets.sh SHEETS_JSON_FILE [VERSION_TAG]

  See utils/example.sheets.json"
	exit 1
fi

# Skip confirmation in CI environment
if [ -z "$CI" ]; then
    read -n 1 -r -s -p "Will deploy files from $PWD, continue?"
    echo ""
else
    echo "Running in CI mode, skipping confirmation."
fi

jq -c '.[]' "$FILE" | while read -r document; do
	name=$(echo "$document" | jq -r .name)
	parentId=$(echo "$document" | jq -r .parentId)
	scriptId=$(echo "$document" | jq -r .scriptId)

	echo "---------------------------------------------------"
	echo "Updating $name"
	cat <<EOF >.clasp.json
{
  "scriptId": "$scriptId",
  "rootDir": "$PWD",
  "parentId": $parentId
}
EOF

    # Push code
	echo "Pushing code..."
	npx clasp push --force

    # Handle deployments
    echo "Handling deployments..."
    if [ -n "$TAG" ]; then
        DESCRIPTION="$TAG - $DATE"
    else
        DESCRIPTION="Manual deploy - $DATE"
    fi

    # List deployments and parse IDs
    # Expected output format from clasp deployments:
    # 2 Deployments.
    # - <ID> @<Version> - <Description>
    DEPLOYMENT_IDS=$(npx clasp deployments | grep "^- " | awk '{print $2}')

    if [ -z "$DEPLOYMENT_IDS" ]; then
        echo "No existing deployments found. Creating a new one..."
        npx clasp deploy -d "$DESCRIPTION"
    else
        echo "Updating existing deployments..."
        for id in $DEPLOYMENT_IDS; do
            echo "Redeploying deployment ID: $id"
            npx clasp deploy -i "$id" -d "$DESCRIPTION"
        done
    fi
done
