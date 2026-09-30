// Lists the jsx-a11y findings only (the rest of `npm run lint` has its own, unrelated backlog).
//   npm run lint:a11y                 plain list, exit 1 if any finding is an error
//   npm run lint:a11y -- --markdown   the same as a Markdown table (docs/a11y-backlog.md)
import path from 'node:path'
import { ESLint } from 'eslint'

const eslint = new ESLint()
const results = await eslint.lintFiles(['src'])

const rows = []
let errors = 0
for (const file of results) {
  for (const m of file.messages) {
    if (!m.ruleId?.startsWith('jsx-a11y/')) continue
    if (m.severity === 2) errors += 1
    rows.push({ file: path.relative(process.cwd(), file.filePath).replaceAll('\\', '/'), line: m.line, rule: m.ruleId.replace('jsx-a11y/', ''), severity: m.severity === 2 ? 'error' : 'warn' })
  }
}
rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

if (process.argv.includes('--markdown')) {
  console.log('| File | Line | Rule | Level |\n|---|---|---|---|')
  for (const r of rows) console.log(`| ${r.file} | ${r.line} | ${r.rule} | ${r.severity} |`)
} else if (rows.length === 0) {
  console.log('no jsx-a11y findings')
} else {
  for (const r of rows) console.log(`${r.file}:${r.line}  ${r.severity}  ${r.rule}`)
  console.log(`\n${rows.length} jsx-a11y finding(s), ${errors} error(s)`)
}
process.exit(errors > 0 ? 1 : 0)
