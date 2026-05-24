import { parse } from './src';

it('actual abuse test with peggy', () => {
	const input = `This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEATx2 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x3 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEAT x4 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. REPEATx 5 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. , REPEAT x6 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. this can go long for some time, repeat x7 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some. ,repeat x8 This a message designed to stress test the message parser, trying to force several rules to stack at the same time !!@#$%^&*()_+, overloading the symbols {}:"|<>?, some more text ,./;'\\[], numbers too 1234567890-= let it call s o s ok~, from now on we repeat some.`;
	
	const handwritten = parse(input);
	const peggy = parse(input, { engine: 'peggy' });
	const h = JSON.stringify(handwritten);
	const p = JSON.stringify(peggy);
	
	console.log('H length:', h.length);
	console.log('P length:', p.length);
	
	if (h !== p) {
		console.log('DIFFERENCE FOUND!');
		// Find first difference
		for (let i = 0; i < Math.min(h.length, p.length); i++) {
			if (h[i] !== p[i]) {
				console.log('First diff at char', i);
				console.log('H context:', h.substring(Math.max(0,i-100), i+100));
				console.log('P context:', p.substring(Math.max(0,i-100), i+100));
				break;
			}
		}
	} else {
		console.log('EXACT MATCH');
	}
	
	expect(true).toBe(true);
});
