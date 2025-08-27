import path from 'path';

console.log('Initing Data dir', process.env.DATA_DIR);
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'app', 'ic-data');
