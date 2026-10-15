// Offline report: never reads a user's DSH home or changes a running installation.
import { readFile } from 'node:fs/promises'
import { checkWorkstreamContext } from '../src/host/workstreams-compat.js'

const flags = process.argv.slice(2)
if (flags.includes('--help')) {
  console.log('Usage: node scripts/workspace-preflight.mjs --dsh-version VERSION [--context-module ./fixture.mjs]\ncontext-module must export a caller-supplied ctx object. It is executable code, not a live-session attachment. Exit 2 means unqualified/missing API evidence.')
  process.exit(0)
}
const value = flag => flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : undefined
const matrix = JSON.parse(await readFile(new URL('../deployment/compatibility.json', import.meta.url), 'utf8'))
const version = value('--dsh-version')
const moduleName = value('--context-module')
let shape
if (moduleName) {
  const { pathToFileURL } = await import('node:url')
  const { resolve } = await import('node:path')
  shape = checkWorkstreamContext((await import(pathToFileURL(resolve(moduleName)).href)).ctx ?? {})
}
const report = {
  node: process.versions.node,
  nodeSupported: Number(process.versions.node.split('.')[0]) >= 24,
  suppliedDshVersion: version ?? null,
  candidateVersion: matrix.candidateDshVersions.includes(version),
  qualifiedReleaseVersion: matrix.qualifiedReleaseDshVersions.includes(version),
  apiShape: shape ?? 'NOT CHECKED: run runtime pilot with actual DSH context',
  runtimeAcceptance: 'REQUIRED PER DEPLOYMENT; not tested by this offline command',
  changesMade: false,
}
console.log(JSON.stringify(report, null, 2))
if (!report.nodeSupported || !report.qualifiedReleaseVersion || !shape?.compatibleShape) process.exitCode = 2
