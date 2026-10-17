"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const semver = /\d+\.\d+\.\d+/;
const failures = [];

function read(rel) {
  const file = path.join(root, rel);
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    failures.push(`${rel}: ${err.message}`);
    return "";
  }
}

function versionLine(text) {
  const line = text.split(/\r?\n/).find((row) => row.trim());
  return line ? line.trim() : "";
}

function appVersion(text) {
  const matches = [...text.matchAll(/const\s+APP_VERSION\s*=\s*"([^"]*)"/g)];
  if (matches.length !== 1) return null;
  return matches[0][1];
}

function journalSentence(html) {
  const match = html.match(
    /<p\b[^>]*\bclass\s*=\s*["'][^"']*\bjournal-note\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
  );
  return match ? match[1] : null;
}

function headings(markdown) {
  return markdown.split(/\r?\n/).filter((line) => /^#{1,6}\s/.test(line));
}

const version = versionLine(read("VERSION"));
const app = appVersion(read("core.js"));

if (!version) failures.push("VERSION is empty");
if (app == null) failures.push('core.js has no single APP_VERSION string');
if (version && app != null && version !== app) {
  failures.push(`VERSION (${version}) and APP_VERSION (${app}) differ`);
}

const sentence = journalSentence(read("index.html"));
if (sentence == null) {
  failures.push("journal sentence not found in index.html");
} else if (semver.test(sentence)) {
  failures.push("journal sentence contains a semver");
}

function checkHeadings(rel) {
  const lines = headings(read(rel));
  if (lines.length === 0) {
    failures.push(`${rel} heading not found`);
    return;
  }
  for (const line of lines) {
    if (semver.test(line)) failures.push(`${rel} heading contains a semver`);
  }
}

checkHeadings("GROK_STATUS.md");
checkHeadings("CURSOR_HANDOFF.md");

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log("release stamps ok");
