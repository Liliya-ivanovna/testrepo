#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import pdf from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? https : http;
    getter
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // redirect
          return resolve(downloadToBuffer(res.headers.location));
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

function splitIntoPages(rawText) {
  // pdf-parse gives a single text; pages usually separated by formfeeds or multiple newlines
  const pages = rawText
    .split(/\f|\n\s*\n\s*\n+/g)
    .map((p) => p.trim())
    .filter(Boolean);
  return pages.length > 0 ? pages : [rawText];
}

function extractTasksFromText(text) {
  // Heuristics for Ukrainian textbooks: look for lines starting with numbering or keywords
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tasks = [];
  let buffer = [];
  let currentId = null;

  const taskStartRegexes = [
    /^(Вправа|Вправи|Завдання|Номер|Приклад|Підсумкове завдання)\s*[№#]?[\s:]*([0-9]+)?/i,
    /^(\d{1,3})[\.)\]]\s+/, // 1) 2. 3]
    /^№\s*(\d{1,4})/, // № 123
  ];

  const flush = () => {
    if (buffer.length > 0) {
      tasks.push({ id: currentId ?? null, text: buffer.join('\n') });
      buffer = [];
      currentId = null;
    }
  };

  for (const line of lines) {
    const starter = taskStartRegexes.find((re) => re.test(line));
    if (starter) {
      flush();
      const m = taskStartRegexes[0].exec(line) || taskStartRegexes[1].exec(line) || taskStartRegexes[2].exec(line);
      currentId = m && (m[2] || m[1]) ? String(m[2] || m[1]) : null;
      buffer.push(line);
    } else {
      if (buffer.length === 0) {
        // skip preamble lines to keep extraction focused
        continue;
      }
      buffer.push(line);
    }
  }
  flush();
  return tasks;
}

function toCsv(rows) {
  const escape = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
  const header = ['page', 'index', 'id', 'text'];
  const out = [header.join(',')];
  for (const r of rows) {
    out.push([r.page, r.index, r.id ?? '', r.text?.replace(/\r?\n/g, ' ').trim()].map(escape).join(','));
  }
  return out.join('\n');
}

async function main() {
  const url = process.argv[2] || 'https://lib.imzo.gov.ua/wa-data/public/site/books2/7-kl-nush/7kl_Algebra_2024.pdf';
  const out = process.argv[3] || 'out/tasks.json';
  const format = process.argv[4] || (out.toLowerCase().endsWith('.csv') ? 'csv' : 'json');

  console.error(`Downloading PDF: ${url}`);
  const buf = await downloadToBuffer(url);
  console.error(`Parsing PDF...`);
  const data = await pdf(buf);
  const pages = splitIntoPages(data.text);

  const aggregated = [];
  pages.forEach((pageText, pageIdx) => {
    const tasks = extractTasksFromText(pageText);
    tasks.forEach((t, i) => {
      aggregated.push({ page: pageIdx + 1, index: i + 1, id: t.id, text: t.text });
    });
  });

  const absOut = path.isAbsolute(out) ? out : path.join(__dirname, '..', out);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  if (format === 'csv') {
    fs.writeFileSync(absOut, toCsv(aggregated), 'utf8');
  } else {
    fs.writeFileSync(absOut, JSON.stringify(aggregated, null, 2), 'utf8');
  }
  console.error(`Wrote ${aggregated.length} tasks to ${absOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


