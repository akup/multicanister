#!/usr/bin/env bash
set -e

rm -rf ./src/.shared
mkdir ./src/.shared || true
mkdir ./src/.shared/generated || true
mkdir ./src/.shared/src || true
mkdir ./src/.shared/src/utils || true
mkdir ./src/.shared/src/crypto || true

cp -rf ../../../../projects/launcher/internet-identity/src/frontend/generated ./src/.shared/
cp -rf ../../../../projects/launcher/internet-identity/src/frontend/src/utils ./src/.shared/src/
cp -rf ../../../../projects/launcher/internet-identity/src/frontend/src/crypto ./src/.shared/src/