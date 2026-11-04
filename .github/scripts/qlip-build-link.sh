#!/bin/sh
# The qlip build a story run uploaded, for the Discord message's "Qlip visual tests" link.
#
# usage: qlip-build-link.sh <story run log>
#
# qlip prints one line after uploading, e.g.
#   [qlip] uploaded build 20261010-104435: 635 entries from 54 contexts (…) → https://qlip.qoretechnologies.com
# (older qlip: `uploaded build 20260629-123456 (12 fragments, …) → …`). The id is server-assigned, so it is read
# from that line. It ends at the first space or colon: taking everything up to the space kept the colon, and the
# link went to build `20261010-104435:`, which does not exist.
#
# Prints GITHUB_OUTPUT lines `build_id=` and `url=` (the dashboard's builds are global: /builds/<id>), or nothing
# when no build was uploaded.
set -eu

log=${1:?usage: qlip-build-link.sh <story run log>}
# ANSI colours are stripped first: one between `[qlip]` and `uploaded` would hide the line
line=""
if [ -f "$log" ]; then
    line=$(sed -E 's/\x1b\[[0-9;]*m//g' "$log" | grep -aE '\[qlip\] uploaded build ' | tail -1 || true)
fi
build_id=$(printf '%s' "$line" | sed -nE 's/.*uploaded build ([^ :]+).*/\1/p')
server=$(printf '%s' "$line" | sed -nE 's/.* → (https?:[^ ]+).*/\1/p')
server=${server:-https://qlip.qoretechnologies.com}
echo "Resolved qlip build='${build_id:-<none>}' server='${server}'" >&2
if [ -n "$build_id" ]; then
    echo "build_id=$build_id"
    echo "url=$server/builds/$build_id"
fi
