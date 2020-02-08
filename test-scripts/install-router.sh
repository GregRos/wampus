#!/usr/bin/env bash
echo "Going to nuke wamp_router if it exists"
rm -rf .tmp/wamp_router
eval "$(gimme 1.13)"
export ORIG_DIR="$PWD"
mkdir -p .tmp/wamp_router
cd .tmp/wamp_router || exit

echo "Cloning nexus wamp_router"
go get github.com/gammazero/nexus
cd "$HOME/go/src/github.com/gammazero/nexus/nexusd" || exit

echo "Building go"
go build

echo "Copying config file"
cp -f $ORIG_DIR/test-scripts/nexus.json ./etc/nexus.json

chmod +x ./nexusd
./nexusd &


