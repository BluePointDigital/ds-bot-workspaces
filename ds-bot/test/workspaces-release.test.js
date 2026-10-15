import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

test('fork release scans tagged source and packed payload before upload without npm publishing', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8')
  const sourceScan = workflow.indexOf('node scripts/scan.mjs')
  const packageScan = workflow.indexOf('node ../scripts/scan.mjs')
  const upload = workflow.indexOf('gh release upload')
  assert.ok(sourceScan > 0 && packageScan > sourceScan && upload > packageScan)
  assert.match(workflow, /git archive HEAD/)
  assert.match(workflow, /--package/)
  assert.match(workflow, /sha256sum/)
  assert.match(workflow, /PRERELEASE !== 'true'/)
  assert.match(workflow, /Refusing candidate release in upstream repository/)
  assert.doesNotMatch(workflow, /^\s+npm publish\b/m)
  assert.doesNotMatch(workflow, /^\s+id-token:\s*write/m)
})

test('candidate package stays opt-in and cannot be accidentally npm-published', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.private, true)
  assert.match(pkg.version, /-workspaces\.\d+$/)
  assert.ok(pkg.files.includes('deployment/'))
  assert.ok(pkg.files.includes('NOTICE'))
  const matrix = JSON.parse(await readFile(new URL('../deployment/compatibility.json', import.meta.url), 'utf8'))
  assert.equal(matrix.runtimeAcceptanceRequired, true)
  assert.deepEqual(matrix.qualifiedReleaseDshVersions, [])
})
