#!/bin/sh
# What a tests run may tell people to install: the version this commit published, and only once npm has it.
#
# publish.yml publishes in parallel with the tests, and it may publish nothing (package.json's version is
# already on npm), be superseded by a newer push, or fail. So the version is worked out by the script
# publish.yml uses (release-version.sh), then named only if npm answers with it. Run #482 told people to
# `yarn add @qoretechnologies/reqraft@v0.10.63-canary.…`, a version the tests job made up and never published.
#
# usage (from the repository root):
#   published-version.sh push <publish runs url>
#   published-version.sh pull_request <PR number> <head sha> <publish runs url>
#
# Prints GITHUB_OUTPUT lines:
#   version=<the published version>     (only when npm has it)
#   field=<what the Discord embed's Version field says>
#   note=<the end of the PR success message: how to install it, or why there is nothing to install>
set -eu

here=$(dirname "$0")
event=${1:?usage: published-version.sh push <url> | pull_request <PR number> <head sha> <url>}
if [ "$event" = pull_request ]; then
    computed=$("$here/release-version.sh" pull_request "${2:?}" "${3:?}")
    runs=${4:?the publish runs url is required}
else
    computed=$("$here/release-version.sh" "$event")
    runs=${2:?the publish runs url is required}
fi
value() { printf '%s\n' "$computed" | sed -n "s/^$1=//p"; }
name=$(value name)
base=$(value base)
publish=$(value publish)
version=$(value version)

if [ "$publish" = true ] && [ "$(npm view "$name@$version" version 2>/dev/null || true)" = "$version" ]; then
    echo "version=$version"
    echo "field=$version"
    echo "note=, install the prerelease via \`yarn add $name@$version\`."
elif [ "$publish" = true ]; then
    echo "field=none on npm yet"
    echo "note=. No prerelease is on npm for this commit yet: see the [Publish run]($runs)."
else
    echo "field=none ($base is already on npm)"
    echo "note=. No prerelease was cut: package.json is at $base, which is already on npm."
fi
