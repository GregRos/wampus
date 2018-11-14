#!/usr/bin/env bash
echo "Going to nuke wamp_router if it exists"
rm -rf .tmp/wamp_router
export ORIG_DIR="$PWD"
mkdir -p .tmp/wamp_router
cd .tmp/wamp_router

echo "Cloning nexus wamp_router"
git clone http://github.com/gammazero/nexus
cd nexus/nexusd

echo "Building go"
go build -i

echo "Copying config file"
cp -f $ORIG_DIR/test_scripts/nexus.json ./etc/nexus.json

chmod +x ./nexusd
./nexusd &


