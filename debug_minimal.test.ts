import { parse } from './src';

const patterns = [
  // The exact divergence point
  `()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. this can go long for some time, repeat x7`,
  // Without strike
  `()_+, abc def ghi`,
  // Simple case
  `()_+abc`,
  // After bold close
  `*bold*()_+, overloading`,
  // Nested
  `_italic_ *bold* ()_+ test`,
];

for (const input of patterns) {
  it(`PEG handles: ${input.substring(0, 50)}`, () => {
    const h = parse(input);
    const p = parse(input, { engine: 'peggy' });
    const hJson = JSON.stringify(h);
    const pJson = JSON.stringify(p);
    if (hJson !== pJson) {
      console.log(`INPUT: ${input}`);
      console.log('H:', hJson);
      console.log('P:', pJson);
      // Show first diff
      for (let i = 0; i < Math.min(hJson.length, pJson.length); i++) {
        if (hJson[i] !== pJson[i]) {
          console.log(`First diff at char ${i}`);
          console.log(`H: ${hJson.substring(Math.max(0,i-60), i+60)}`);
          console.log(`P: ${pJson.substring(Math.max(0,i-60), i+60)}`);
          break;
        }
      }
    }
    expect(hJson).toBe(pJson);
  });
}
