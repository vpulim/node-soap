#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import console from 'node:console';
import process from 'node:process';

const summaryPath = path.join(path.dirname(), '..', 'coverage', 'coverage-summary.json');
const badgeDir = path.join(path.dirname(), '..', 'badges');
const badgePath = path.join(badgeDir, 'coverage.json');

function getColor(percent) {
  if (percent >= 90) {
    return 'brightgreen';
  }
  if (percent >= 80) {
    return 'green';
  }
  if (percent >= 70) {
    return 'yellowgreen';
  }
  if (percent >= 60) {
    return 'yellow';
  }
  if (percent >= 50) {
    return 'orange';
  }
  return 'red';
}

if (!fs.existsSync(summaryPath)) {
  console.error('coverage summary not found at coverage/coverage-summary.json');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const lines = summary.total && summary.total.lines;

if (!lines || typeof lines.pct !== 'number') {
  console.error('invalid coverage summary: missing total.lines.pct');
  process.exit(1);
}

const pct = Number(lines.pct.toFixed(1));
const color = getColor(pct);

const badge = {
  schemaVersion: 1,
  label: 'coverage',
  message: `${pct}%`,
  color,
};

fs.mkdirSync(badgeDir, { recursive: true });
fs.writeFileSync(badgePath, JSON.stringify(badge, null, 2) + '\n', 'utf8');

console.log(`updated ${path.relative(process.cwd(), badgePath)} to ${pct}%`);
