# Monorepo DEX Project

Project contains monorepository with rust and typescript.
Typescript includes tool for deploying.


## How to start project

Install pnpm
```sh
npm i pnpm -g
pnpm install
```

Install PocketIc, according to instruction for your platform
https://github.com/dfinity/pocketic

Add it to your .profile
```sh
export POCKET_IC_BIN="$PATH_TO_DOWNLOADED_BIN/pocket-ic"
```
and source it

Then you can run in terminal in any folder:
```sh
$POCKET_IC_BIN --help
```