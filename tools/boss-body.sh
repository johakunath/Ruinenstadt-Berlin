#!/usr/bin/env bash
# H4: a Pixal3D boss mesh to a skinned game body in one go (docs/local-ai-assets.md › W8):
# size and decimate, bake to the low mesh, check sheet, skin to the base skeleton.
#
#   bash tools/boss-body.sh <pixal3d.glb> <kind> <human|female> [tris=8000] [gain=1.3]
#
# Writes assets/characters/boss-<kind>.glb (PREFIX=body for a normal enemy: body-<kind>.glb) and the check sheet
# <dir>/<kind>-sheet.png next to the input.
set -euo pipefail
src=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
kind=$2
base=$([ "$3" = female ] && echo human2 || echo human1)
tris=${4:-8000}
gain=${5:-1.3}
prefix=${PREFIX:-boss}
root=$(cd "$(dirname "$0")/.." && pwd)
dir=$(dirname "$src")
blender=${BLENDER:-"/c/Program Files/Blender Foundation/Blender 5.3/blender.exe"}
height=$([ "$base" = human2 ] && echo 1.8 || echo 1.83)

"$blender" -b --python "$root/tools/comfy/prepare_toy_model.py" -- --in "$src" --out "$dir/$kind-mid.glb" --height "$height" --tris 60000 --tex 2048 | grep PREPARE
"$blender" -b --python "$root/tools/blender/bake_low.py" -- --in "$dir/$kind-mid.glb" --out "$dir/$kind-low.glb" --tris "$tris" --tex 1024 | grep -E '^BAKE'
"$blender" -b --python "$root/tools/comfy/prepare_toy_model.py" -- --in "$dir/$kind-low.glb" --out "$dir/$kind-low-chk.glb" --height "$height" --tris 60000 --tex 1024 --sheet "$dir/$kind-sheet.png" | grep 'PREPARE OK'
"$blender" -b --python "$root/tools/blender/boss_body.py" -- --base "$root/assets/characters/$base.glb" --mesh "$dir/$kind-low-chk.glb" --out "$root/assets/characters/$prefix-$kind.glb" --name "$kind" --gain "$gain" | grep -E '^BOSS'
