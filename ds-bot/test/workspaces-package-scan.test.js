import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'ds-bot-scan-fixture-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'LICENSE'), 'Apache License 2.0\n')
  await writeFile(join(root, 'README.md'), 'Synthetic package for scanner regression.\n')
  await writeFile(join(root, 'NOTICE'), 'Synthetic contributor notice.\n')
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'ds-bot', files: ['LICENSE'], repository: 'https://example.org/repo', homepage: 'https://example.org', bugs: 'https://example.org/issues' }))
  const scan = () => spawnSync(process.execPath, ['../scripts/scan.mjs', root, '--package'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
  return { root, scan }
}

test('package-mode scanner accepts package layout without weakening license requirements', async t => {
  const f = await fixture(t)
  assert.equal(f.scan().status, 0)
  await rm(join(f.root, 'LICENSE'))
  const result = f.scan()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /no LICENSE at the root/)
})

test('package-mode scanner rejects generated credential-shaped data without printing it', async t => {
  const f = await fixture(t)
  // Deliberately generated fixture, never a usable credential or a committed key.
  const value = ['ghp', '_', 'A1'.repeat(20)].join('')
  await writeFile(join(f.root, 'fixture.txt'), value)
  const result = f.scan()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /secret-github/)
  assert.ok(!result.stdout.includes(value))
  assert.ok(!result.stderr.includes(value))
})

test('package-mode scanner still rejects forbidden runtime-data files', async t => {
  const f = await fixture(t)
  await writeFile(join(f.root, 'session.db'), 'synthetic fixture')
  const result = f.scan()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /forbidden-file/)
})
