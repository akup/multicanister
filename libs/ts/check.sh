#!/usr/bin/env bash
set -e

if [ "$1" == "check" ]; then
	echo "Start check"
	FILE=./hash.txt
	[ -f ./hash.txt ] && echo "$FILE exist." || (echo "Start build f" && exit 1)

	[ -d ./dist ] && echo "Dist exist" || (echo "Start build d" && exit 1)

	VAR2=$(find ./src -type f -print0  | xargs -0 sha1sum | sha1sum)
	VAR1=$(cat $FILE)

	if [ "$VAR1" == "$VAR2" ]; then
		echo "Hash match. Skip build"
		exit 0
	else
		echo "Hash missmatch. Start build"
		exit 1
	fi
elif [ "$1" == "save" ]; then
	echo "Start save"
	find ./src -type f -print0 | xargs -0 sha1sum | sha1sum > ./hash.txt
fi