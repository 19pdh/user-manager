#!/bin/sh
# USAGE:
# ./utils/ci.sh [SCRIPT_ID] [VERSION_TAG]
#
# CI/CD script that pushes code and updates deployments for 
# the current project. Assumes that clasp is configured.

SCRIPT_ID="$1"
TAG="$2"
DATE=$(date +"%Y-%m-%d %H:%M")

# Create clasp.json
cat <<EOF >.clasp.json
{
  "scriptId": "$SCRIPT_ID",
  "rootDir": "$PWD"
}
EOF

# Push code
echo "Pushing code..."
npx clasp push --force

# Update deployments
echo "Update deployments..."
if [ -n "$TAG" ]; then
    DESCRIPTION="$TAG - $DATE"
else
    DESCRIPTION="Manual deploy - $DATE"
fi

# List deployments and parse IDs
# Expected output format from clasp deployments:
# 2 Deployments.
# - <ID> @HEAD (ignored)
# - <ID> @<Version> - <Description>
DEPLOYMENT_IDS=$(npx clasp deployments | grep "^- " | grep -v "@HEAD" | awk '{print $2}')

if [ -z "$DEPLOYMENT_IDS" ]; then
    echo "No existing deployments found. Creating a new one..."
    npx clasp deploy -d "$DESCRIPTION"
    DEPLOYMENT_IDS=$(npx clasp deployments | grep "^- " | grep -v "@HEAD" | awk '{print $2}')
fi


echo "Updating existing deployments..."
for id in $DEPLOYMENT_IDS; do
    echo "Redeploying deployment ID: $id"
    APP_URL="https://script.google.com/macros/s/$id/exec"
    #npm run build #TODO: inject APP_URL into build
    #TODO: deploy confirm-zhr.html to FTP
    npx clasp deploy -i "$id" -d "$DESCRIPTION"
done

