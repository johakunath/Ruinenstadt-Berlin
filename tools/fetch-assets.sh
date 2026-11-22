#!/usr/bin/env bash
# Downloads the CC0 source packs into assets-src/ (not committed). Run from the repo root, then
# `npm run assets`. The packs are free on itch.io ("name your own price"); no login needed.
# If itch.io changes its download flow, download the three zips by hand from
#   https://quaternius.itch.io/universal-animation-library
#   https://quaternius.itch.io/universal-animation-library-2
#   https://quaternius.itch.io/universal-base-characters
#   https://quaternius.itch.io/modular-character-outfits-fantasy   (LA3: the Ranger boots, `ranger_boots` in hero_clothes.py)
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
fetch modular-character-outfits-fantasy "$tmp/outfits.zip"
for z in ual1 ual2 ubc; do mkdir -p "$tmp/$z" && unzip -qo "$tmp/$z.zip" -d "$tmp/$z"; done

# Only the pack folders are replaced: assets-src/ai/ keeps the local AI sources (docs/local-ai-assets.md).
rm -rf assets-src/UAL1_Standard.glb assets-src/UAL2_Standard.glb assets-src/body assets-src/hair assets-src/mechs assets-src/outfits
mkdir -p assets-src
cp "$tmp"/ual1/*/Unreal-Godot/UAL1_Standard.glb "$tmp"/ual2/*/Unreal-Godot/UAL2_Standard.glb assets-src/
cp -r "$tmp"/ubc/*/"Base Characters/Godot - UE" assets-src/body
cp -r "$tmp"/ubc/*/Hairstyles/"Rigged to Head Bone"/"glTF (Godot -Unreal)" assets-src/hair
mkdir -p assets-src/outfits && unzip -qo "$tmp/outfits.zip" -d assets-src/outfits
# M15: Quaternius Animated Mech Pack (CC0) for mech.glb and mechbig.glb (`node tools/build-creatures.mjs`).
# The Drive copy linked on quaternius.com is often over quota; OpenGameArt hosts the same March 2021 zip.
curl -sS -L https://opengameart.org/sites/default/files/animated_mech_pack_-_march_2021.zip -o "$tmp/mech.zip"
mkdir -p "$tmp/mech" assets-src/mechs && unzip -qo "$tmp/mech.zip" -d "$tmp/mech"
cp "$tmp"/mech/*/FBX/{Leela,Mike}.fbx "$tmp"/mech/*/Textures/{Leela,Mike}_Texture.png "$tmp"/mech/*/License.txt assets-src/mechs/
echo "assets-src/ ready. Next: npm run assets, node tools/build-creatures.mjs"
