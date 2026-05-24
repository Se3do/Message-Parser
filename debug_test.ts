import { parse } from './src';

// Mini reproduction of the issue pattern
const input = '*()_+abc~def~ghi_jkl';
const result = parse(input);
console.log(JSON.stringify(result, null, 2));
