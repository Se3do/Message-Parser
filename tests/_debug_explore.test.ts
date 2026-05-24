import { parse } from '../src';

const PREFIX = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\\\[], numbers too 1234567890-= let it call s o s ok';
const STRIKE = '~, from now on we repeat some. ';
const REPEAT = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. ';

// Minimal examples: underscore followed by strike patterns
const testCases: {label: string, text: string}[] = [];

// Test 1: underscore then single tilde (no match)
testCases.push({
  label: 'underscore+tildes',
  text: '_abc~def~ghi'
});

// Test 2: underscore then tilde pair
testCases.push({
  label: 'underscore+tildePair',
  text: '_abc~def~ghi_jkl'
});

// Test 3: prefix with 1 repetition only
testCases.push({
  label: 'prefix+onerep',
  text: PREFIX + STRIKE + 'REPEATx1 ' + PREFIX
});

// Test 4: prefix with 1 rep including trailing strike
testCases.push({
  label: 'prefix+onerep+strike',
  text: PREFIX + STRIKE + 'REPEATx1 ' + PREFIX + STRIKE
});

// Test 5: two underscores, strike between them, then text, then third underscore
testCases.push({
  label: '3underscores-strikes',
  text: '_aaa~bbb~ccc_ddd_eee'
});

// Test 6: three underscores, each followed by strike
testCases.push({
  label: '3u-strikes',
  text: '_aaa~bbb~ccc_ddd~eee~fff_ggg~hhh~iii'
});

// Test 7: simple 2 u with strike
testCases.push({
  label: '2u-strike',
  text: '_aaa~bbb~ccc_ddd'
});

testCases.push({
  label: 'PREFIX with _ at 0',
  text: '_abc~def~ghi_more'
});

testCases.push({
  label: 'PREFIX 3 under with strike in first',
  text: '_abc~def~ghi_jkl~mno~pqr_stu'
});

testCases.push({
  label: 'PREFIX 3 under with strike between all',
  text: '_abc~def~ghi_jkl~mno~pqr_stu~vwx~yzz'
});

testCases.push({
  label: 'SIMPLE: _ x ~ y ~ z _',
  text: '_x~y~z_'
});

testCases.push({
  label: 'SIMPLE: _ x ~ y ~ z _ a _',
  text: '_x~y~z_a_'
});

testCases.push({
  label: 'SIMPLE: _ x ~ y ~ z _ a ~ b ~ c _',
  text: '_x~y~z_a~b~c_'
});

testCases.push({
  label: 'SIMPLE: _ x _ y ~ z ~ w _',
  text: '_x_y~z~w_'
});

testCases.push({
  label: 'SIMPLE: _ x _ y _ z ~ w ~ v _',
  text: '_x_y_z~w~v_'
});

testCases.push({
  label: 'SIMPLE: _ x _ y _',
  text: '_x_y_'
});

testCases.push({
  label: 'SIMPLE: _ x ~ y ~ z _ a ~ b ~ c _ d ~ e ~ f _',
  text: '_x~y~z_a~b~c_d~e~f_'
});

test('PEG behavior exploration', () => {
  for (const tc of testCases) {
    const peg = parse(tc.text, { engine: 'peggy' });
    const pegStr = JSON.stringify(peg);
    console.log(`\n=== ${tc.label} ===`);
    console.log(pegStr);
  }
});
