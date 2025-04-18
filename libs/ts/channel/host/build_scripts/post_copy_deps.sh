#!/usr/bin/env bash
set -e

mkdir ./dist/.shared/generated || echo "Folder exists"

cp -rf ./src/.shared/generated ./dist/.shared