### PDF Tasks Crawler (Node.js)

Extract tasks from the Algebra 7th grade PDF via parsing (no Playwright).

### Prerequisites
- Node.js 16+ (npm available)

### Install
```
npm install
```

### Run
Default URL is the Algebra 7 PDF.
```
# JSON output (default)
npm run crawl
# or
node src/crawl.js

# CSV output with explicit args
node src/crawl.js "https://lib.imzo.gov.ua/wa-data/public/site/books2/7-kl-nush/7kl_Algebra_2024.pdf" out/tasks.csv csv
```

- Arg 1: PDF URL (optional; defaults to the provided URL)
- Arg 2: Output path (optional; defaults to `out/tasks.json`)
- Arg 3: Format `json` or `csv` (optional; inferred from extension)

### How it works
- Downloads the PDF via HTTPS
- Parses text using `pdf-parse`
- Splits into pages heuristically
- Extracts tasks using regexes for Ukrainian textbooks (`Вправа`, `Завдання`, `№`, numbered like `1)`, `2.`, etc.)
- Writes JSON or CSV including page numbers

### Tuning
Adjust regexes in `src/crawl.js` (`extractTasksFromText`) for other books if needed.
