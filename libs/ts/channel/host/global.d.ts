declare interface Controller {}

declare const process: {
  env: {
    [key: string]: any;
  };
};

declare module 'borc'; // FIXME костыль из II
declare module 'bip39'; // FIXME костыль из II

// TODO сделать билд через esbuild. Это позволит не копировать исходники II сюда, а сделать нормальный бандл
