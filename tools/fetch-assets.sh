#!/usr/bin/env bash
# Downloads the CC0 source packs into assets-src/ (not committed). Run from the repo root, then
# `npm run assets`. The packs are free on itch.io ("name your own price"); no login needed.
# If itch.io changes its download flow, download the three zips by hand from
#   https://quaternius.itch.io/universal-animation-library
#   https://quaternius.itch.io/universal-animation-library-2
#   https://quaternius.itch.io/universal-base-characters
# and unpack them as this script does.
set -euo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fetch() { # slug, output zip
  local slug=$1 out=$2 page csrf id url
  page=$(curl -sS -c "$tmp/jar" "https://quaternius.itch.io/$slug")
  csrf=$(grep -oE 'csrf_token" value="[^"]+' <<<"$page" | head -1 | sed 's/.*value="//')
  # The purchase page lists the upload id of the free Standard zip.
  curl -sS -b "$tmp/jar" -c "$tmp/jar" -X POST --data-urlencode "csrf_token=$csrf" "https://quaternius.itch.io/$slug/download_url" -o "$tmp/url.json"
  url=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).url)' "$tmp/url.json")
  id=$(curl -sS -b "$tmp/jar" "$url" | grep -oE 'data-upload_id="[0-9]+"' | head -1 | grep -oE '[0-9]+')
  curl -sS -b "$tmp/jar" -X POST --data-urlencode "csrf_token=$csrf" \
    "https://quaternius.itch.io/$slug/file/$id?source=view_game&as_props=1&after_download_lightbox=true" -o "$tmp/file.json"
  url=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).url)' "$tmp/file.json")
  curl -sS -L "$url" -o "$out"
}

fetch universal-animation-library "$tmp/ual1.zip"
fetch universal-animation-library-2 "$tmp/ual2.zip"
fetch universal-base-characters "$tmp/ubc.zip"
for z in ual1 ual2 ubc; do mkdir -p "$tmp/$z" && unzip -qo "$tmp/$z.zip" -d "$tmp/$z"; done

rm -rf assets-src
mkdir -p assets-src
cp "$tmp"/ual1/*/Unreal-Godot/UAL1_Standard.glb "$tmp"/ual2/*/Unreal-Godot/UAL2_Standard.glb assets-src/
cp -r "$tmp"/ubc/*/"Base Characters/Godot - UE" assets-src/body
cp -r "$tmp"/ubc/*/Hairstyles/"Rigged to Head Bone"/"glTF (Godot -Unreal)" assets-src/hair
echo "assets-src/ ready. Next: npm run assets"
