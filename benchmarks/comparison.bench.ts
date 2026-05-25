#!/usr/bin/env npx ts-node
/**
 * Handwritten vs PEG parser comparison benchmark.
 *
 * Runs every fixture with both engines and reports side-by-side ops/sec.
 * Run: yarn bench:compare
 */

import { Bench, type Task } from 'tinybench';
import { parse } from '../src';
import type { Options } from '../src';

const fullOptions: Options = {
	colors: true,
	emoticons: true,
	katex: { dollarSyntax: true, parenthesisSyntax: true },
};

type Fixture = {
	name: string;
	input: string;
	options?: Options;
};

type BenchCategory = {
	name: string;
	time?: number;
	warmupTime?: number;
	fixtures: Fixture[];
};

const categories: BenchCategory[] = [
	{
		name: 'Plain Text',
		fixtures: [
			{ name: 'short', input: 'Hello world' },
			{ name: 'medium', input: 'The quick brown fox jumps over the lazy dog. This is a typical message one might send in a chat application.' },
			{ name: 'long', input: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20).trim() },
		],
	},
	{
		name: 'Emphasis / Formatting',
		fixtures: [
			{ name: 'bold', input: '**Hello world**' },
			{ name: 'italic', input: '_Hello world_' },
			{ name: 'strike', input: '~~Hello world~~' },
			{ name: 'nested', input: '**bold _italic_ and ~~strike~~**' },
			{ name: 'deep nesting', input: '**bold _italic ~~strike _deep italic_~~_**' },
			{ name: 'multiple', input: '**bold** normal _italic_ normal ~~strike~~ **more bold** _more italic_' },
		],
	},
	{
		name: 'URLs & Links',
		fixtures: [
			{ name: 'single URL', input: 'Check out https://rocket.chat for more info' },
			{ name: 'multiple URLs', input: 'Visit https://rocket.chat or https://github.com/RocketChat/Rocket.Chat or https://open.rocket.chat' },
			{ name: 'markdown link', input: '[Rocket.Chat](https://rocket.chat)' },
			{ name: 'autolinked domain', input: 'Visit rocket.chat for more info' },
		],
	},
	{
		name: 'Emoji',
		fixtures: [
			{ name: 'single shortcode', input: ':smile:', options: fullOptions },
			{ name: 'triple shortcode (BigEmoji)', input: ':smile::heart::rocket:', options: fullOptions },
			{ name: 'in text', input: 'Hello :smile: world :heart: test :rocket: done', options: fullOptions },
		],
	},
	{
		name: 'Mentions',
		fixtures: [
			{ name: 'single user', input: '@admin' },
			{ name: 'multiple users', input: '@admin @user1 @moderator' },
			{ name: 'channel', input: '#general' },
			{ name: 'mixed', input: 'Hey @admin check #general and @user1' },
		],
	},
	{
		name: 'Code',
		fixtures: [
			{ name: 'inline', input: 'Use `console.log()` for debugging' },
			{ name: 'block', input: '```javascript\nconst x = 1;\nconsole.log(x);\n```' },
			{ name: 'multi inline', input: 'Use `Array.map()` and `Array.filter()` and `Array.reduce()`' },
		],
	},
	{
		name: 'Structured Blocks',
		fixtures: [
			{ name: 'ordered list', input: '1. First item\n2. Second item\n3. Third item' },
			{ name: 'unordered list', input: '- First item\n- Second item\n- Third item' },
			{ name: 'task list', input: '- [x] Done task\n- [ ] Pending task\n- [x] Another done' },
			{ name: 'blockquote', input: '> This is a quoted message\n> with multiple lines' },
			{ name: 'heading', input: '# Hello World' },
			{ name: 'spoiler', input: '||This is a spoiler||' },
		],
	},
	{
		name: 'KaTeX (Math)',
		fixtures: [
			{ name: 'inline', input: 'The formula is $E = mc^2$ in physics', options: fullOptions },
			{ name: 'block', input: '$$\\sum_{i=1}^{n} x_i = x_1 + x_2 + ... + x_n$$', options: fullOptions },
		],
	},
	{
		name: 'Real-World',
		fixtures: [
			{ name: 'simple', input: 'Hey team, the deploy is done ✅' },
			{ name: 'medium', input: '@admin I pushed the fix to `develop` branch. Check https://github.com/RocketChat/Rocket.Chat/pull/12345 for details. :thumbsup:' },
			{ name: 'complex', input: '**Release Notes v7.0**\n- [x] Fix #12345\n- [ ] Update docs\n\n> Important: check https://docs.rocket.chat\n\ncc @admin @devlead #releases :rocket:', options: fullOptions },
		],
	},
	{
		name: 'Timestamps',
		fixtures: [
			{ name: 'unix format', input: '<t:1630360800:f>' },
		],
	},
];

type EngineResult = {
	name: string;
	ops: number;
	mean: number;
};

async function benchEngine(label: string, fixtures: Fixture[], engine: 'handwritten' | 'peggy', time: number, warmup: number): Promise<EngineResult[]> {
	const bench = new Bench({ time, warmupTime: warmup });
	for (const f of fixtures) {
		bench.add(f.name, () => parse(f.input, { ...f.options, engine }));
	}
	await bench.run();
	return bench.tasks.map((t) => ({
		name: t.name,
		ops: t.result?.hz ?? 0,
		mean: (t.result?.mean ?? 0) * 1000,
	}));
}

async function run() {
	console.log('='.repeat(74));
	console.log('  Handwritten vs PEG — Performance Comparison');
	console.log('='.repeat(74));
	console.log();

	let allRatios: number[] = [];

	for (const cat of categories) {
		const time = cat.time ?? 1000;
		const warmup = cat.warmupTime ?? 200;

		const hw = await benchEngine('handwritten', cat.fixtures, 'handwritten', time, warmup);
		const peg = await benchEngine('peggy', cat.fixtures, 'peggy', time, warmup);

		console.log(`── ${cat.name} ${'─'.repeat(Math.max(0, 56 - cat.name.length))}`);
		console.log(`  ${'Benchmark'.padEnd(24)} ${'Handwritten'.padEnd(16)} ${'PEG'.padEnd(16)} Ratio`);
		console.log(`  ${''.padEnd(24)} ${'(ops/s)'.padEnd(16)} ${'(ops/s)'.padEnd(16)}`);
		console.log(`  ${'─'.repeat(70)}`);

		for (let i = 0; i < hw.length; i++) {
			const ratio = peg[i].ops > 0 ? (hw[i].ops / peg[i].ops).toFixed(1) : '∞';
			allRatios.push(parseFloat(ratio) || 0);
			const label = hw[i].name.padEnd(24);
			const hwStr = Math.round(hw[i].ops).toLocaleString().padEnd(16);
			const pegStr = Math.round(peg[i].ops).toLocaleString().padEnd(16);
			console.log(`  ${label} ${hwStr} ${pegStr} ${ratio}x`);
		}
		console.log();
	}

	const avgRatio = allRatios.length > 0 ? (allRatios.reduce((a, b) => a + b, 0) / allRatios.length).toFixed(1) : '?';
	const minRatio = allRatios.length > 0 ? Math.min(...allRatios).toFixed(1) : '?';
	const maxRatio = allRatios.length > 0 ? Math.max(...allRatios).toFixed(1) : '?';

	console.log('='.repeat(74));
	console.log('  Summary');
	console.log('='.repeat(74));
	console.log(`  Average speedup: ${avgRatio}x`);
	console.log(`  Min speedup:     ${minRatio}x`);
	console.log(`  Max speedup:     ${maxRatio}x`);
	console.log();
	console.log('  Done.');
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
