#!/bin/bash
# Sync the motion graphics sources from the repo clone into the Katana workspace (run inside the sandbox from $W).
set -e
W=${W:-$PWD}
git -C "$W/repo" pull -q --ff-only
mkdir -p "$W/comp/mg"
cp "$W/repo/motion/fx.js" "$W/comp/fx.js"
cp "$W/repo/motion/edl.json" "$W/comp/edl.json"
cp "$W"/repo/motion/mg/*.js "$W/comp/mg/"
[ -f "$W/comp/fonts/Hahmlet-VF.ttf" ] || cp "$W/comp/fonts/Hahmlet[wght].ttf" "$W/comp/fonts/Hahmlet-VF.ttf"
[ -f "$W/comp/fonts/Unbounded-VF.ttf" ] || cp "$W/comp/fonts/Unbounded[wght].ttf" "$W/comp/fonts/Unbounded-VF.ttf"
echo "synced $(git -C "$W/repo" log --oneline -1)"
