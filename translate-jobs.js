#!/usr/bin/env node

import { fromJS } from 'immutable';
import generate_cloudformation from './index';

process.stdin.setEncoding('utf8');

const fs   = require('fs');
const args = require('yargs')
const argv = args.argv;

const filename = argv._[0];
const file     = fromJS(JSON.parse(fs.readFileSync(filename)));

console.log(JSON.stringify(generate_cloudformation(file), {}, "\t"));
