import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

interface InputCase {
  markdown: string;
}

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const input = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as InputCase[];
const output = new Array<string>(input.length);
for (let i = 0; i < input.length; i++) {
  output[i] = parse(input[i]!.markdown);
}
writeFileSync(join(outputDir, 'html.json'), JSON.stringify(output));
