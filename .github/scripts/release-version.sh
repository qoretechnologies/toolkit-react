#!/bin/sh
# The version a workflow run publishes, worked out in ONE place: publish.yml publishes it, and tests.yml names
# it in Discord. Two copies of this logic drifted once already: tests.yml made up a canary that nothing
# published and told people to install it.
#
# usage (from the repository root):
#   release-version.sh push
#   release-version.sh pull_request <PR number> <head sha>
#
# Prints GITHUB_OUTPUT lines:
#   name=<the package's name>
#   base=<package.json's version, without any prerelease part>
#   publish=true|false
#   version=<the version this run publishes>     (only when publish=true)
#
# push (develop): package.json's version as it is, which publish.yml's Publish-and-release releases under `beta`.
#
# pull_request: a prerelease OF THE VERSION THIS PR IS RELEASING, the one already in package.json (every PR is
# required to bump it), under the `pr` dist-tag: <base>-pr.<PR>.g<sha7>.
# - Not the next patch: a prerelease of 0.10.35 for a PR releasing 0.10.34 previews a version nobody is merging,
#   and sorts ABOVE the real 0.10.34, so a consumer pinned to the preview never moves forward on upgrade.
#   Semver puts a prerelease below its release and above the previous one:
#     0.10.33  <  0.10.34-pr.92.gabc123  <  0.10.34
# - The sha is prefixed with `g` (git-describe style) so an all-digit short sha can never become an invalid
#   leading-zero numeric identifier.
# - None when <base> is already on npm: this PR has not bumped, because it need not (a CI-, docs- or test-only
#   change) or because it forgot. A prerelease of a released version sorts BELOW that release and would hand
#   consumers something older than they have. Skipped, not failed: a PR that forgot its bump is caught at merge,
#   where the release cannot publish over an existing version.
set -eu

event=${1:?usage: release-version.sh push | pull_request <PR number> <head sha>}
name=$(node -p "require('./package.json').name")
base=$(node -p "require('./package.json').version.split('-')[0]")
echo "name=$name"
echo "base=$base"

case "$event" in
push)
    echo "publish=true"
    echo "version=$(node -p "require('./package.json').version")"
    ;;
pull_request)
    pr=${2:?the PR number is required}
    sha=$(printf '%s' "${3:?the head sha is required}" | cut -c1-7)
    if npm view "$name@$base" version >/dev/null 2>&1; then
        echo "publish=false"
    else
        echo "publish=true"
        echo "version=$base-pr.$pr.g$sha"
    fi
    ;;
*)
    echo "release-version.sh: unknown event '$event'" >&2
    exit 2
    ;;
esac
