#!/bin/sh
## On NixOS or with Nix installed:
#!/usr/bin/env nix-shell -p js google-clasp
#
# USAGE:
# ./utils/updateSheets.sh sheets.json
#
# The sheets.json should be as provided in utils/example.sheets.json
# Value of parentId is Google Sheet ID, and scriptId is script id
# from Extensions > Apps Script.
# To learn more visit: https://github.com/google/clasp

FILE="$1"
[ -z "$FILE" ] &&
	echo "USAGE: 
  updateSheets.sh SHEETS_JSON_FILE

  See utils/example.sheets.json" &&
	exit 1

read -n 1 -r -s -p "Will deploy files from $PWD, continue?"
echo ""

jq -c '.[]' "$FILE" | while read -r document; do
	name=$(echo "$document" | jq -r .name)
	parentId=$(echo "$document" | jq -r .parentId)
	scriptId=$(echo "$document" | jq -r .scriptId)

	echo "Updating $name"
	cat <<EOF >.clasp.json
{
  "scriptId": "$scriptId",
  "rootDir": "$PWD",
  "parentId": $parentId
}
EOF
	yes | clasp push
done
