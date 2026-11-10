#!/usr/bin/env node
/**
 * Finishes a release that `changeset publish` started: pushes the tag the CLI created and creates
 * the GitHub release from `CHANGELOG.md`.
 *
 * `changesets/action@v1` used to do this by parsing `New tag: <pkg>@<version>` from the publish
 * output. `@changesets/cli` v3 prints a different (clack) report, so the action published to npm
 * and silently skipped both steps; 0.3.0 shipped without a tag or a GitHub release. The CLI still
 * creates the local tag, so the missing steps are explicit here.
 *
 * Idempotent: a workflow_dispatch for an already released version pushes nothing new and finds the
 * release already present, so it is a no-op instead of an error.
 *
 *   node scripts/release.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** The tag `changeset publish` creates for a package: `<name>@<version>`. */
export function releaseTag(pkg) {
  return `${pkg.name}@${pkg.version}`
}

/** The body of the `## <version>` section, or `null` when the changelog has none. */
export function changelogEntry(text, version) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start === -1) return null

  const end = lines.findIndex((line, index) => index > start && line.trim().startsWith('## '))
  const body = lines
    .slice(start + 1, end === -1 ? lines.length : end)
    .join('\n')
    .trim()

  return body === '' ? null : body
}

function main() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const tag = releaseTag(pkg)

  // Local tags are created by `changeset publish`; the CLI does not push them. A run with no new
  // tag is a no-op here.
  run('git', ['push', '--tags'])

  if (output('git', ['tag', '--list', tag]).trim() === '') {
    console.log(`release: no tag ${tag}; nothing to announce`)
    return
  }

  if (releaseExists(tag)) {
    console.log(`release: ${tag} already has a GitHub release`)
    return
  }

  const notes = changelogEntry(readFileSync('CHANGELOG.md', 'utf8'), pkg.version)
  if (notes === null) {
    throw new Error(`release: CHANGELOG.md has no entry for ${pkg.version}`)
  }

  run('gh', ['release', 'create', tag, '--verify-tag', '--title', tag, '--notes', notes])
  console.log(`release: created ${tag}`)
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' })
}

function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' })
}

function releaseExists(tag) {
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
