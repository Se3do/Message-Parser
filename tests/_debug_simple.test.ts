import { parse } from '../src';

test('debug', () => {
const section = "This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:\"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. ";

// Build stress_3 exactly as the test does
const s1 = section + ", ";
const s2 = section + ", REPEATx2 ";
const s3 = section + "REPEAT x3 ";

const test3 = s1 + s2 + s3;
const test2 = s1 + s2;

// Check the actual input from hand_vs_peg (first ~3 sections)
const fullInput = 'This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEATx2 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x3 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;\'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.';

// Compare the first part until the first _ in section2
const idx1 = fullInput.indexOf('_');
const idx2 = fullInput.indexOf('_', idx1 + 1);
console.log('FullInput 1st _ at:', idx1, '2nd _ at:', idx2);
console.log('Test3 1st _ at:', test3.indexOf('_'), '2nd _ at:', test3.indexOf('_', test3.indexOf('_') + 1));

// Compare both PEG outputs
console.log('\nFullInput PEG:');
console.log(JSON.stringify(parse(fullInput, { engine: 'peggy' })).substring(0, 800));
console.log('\nTest3 PEG:');
console.log(JSON.stringify(parse(test3, { engine: 'peggy' })).substring(0, 800));

// Also compare PEG of our test2 vs fullInput 2-section equivalent
const full2 = fullInput.substring(0, fullInput.indexOf('REPEAT x3'));
console.log('\nFull2 PEG:');
console.log(JSON.stringify(parse(full2, { engine: 'peggy' })).substring(0, 800));
console.log('\nTest2 PEG:');
console.log(JSON.stringify(parse(test2, { engine: 'peggy' })).substring(0, 800));
});

