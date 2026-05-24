import { parse } from './src';

const input = '*()_+ABC~DEF~GHI_JKL';
const result = parse(input, { engine: 'peggy' });
console.log('PEGGY:', JSON.stringify(result, null, 2));
