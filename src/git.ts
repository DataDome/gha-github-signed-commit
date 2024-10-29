import * as core from '@actions/core'
import { exec } from '@actions/exec'
import {
  FileChanges,
  FileAddition,
  FileDeletion,
} from '@octokit/graphql-schema'

import { getWorkspace } from './utils/cwd'

async function execGit(args: string[]) {
  const debugOutput: string[] = []
  const warningOutput: string[] = []
  const errorOutput: string[] = []

  const defaultArgs: string[] = []

  // Handle workspace
  const workspace = getWorkspace()
  if (workspace !== '') {
    defaultArgs.push('-C')
    defaultArgs.push(workspace)
    core.debug('execGit() - Adding GHA parameter "workspace" to git cli args')
  }

  core.debug('execGit() - defaultArgs: ' + JSON.stringify(defaultArgs))
  core.debug('execGit() - args parameter: ' + JSON.stringify(args))

  const mergedArgs = defaultArgs.concat(args)
  core.debug('execGit() - mergedArgs: ' + JSON.stringify(mergedArgs))

  await exec('git', mergedArgs, {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdline: (data: string) => {
        debugOutput.push(data)
      },
      errline: (error: string) => {
        if (/^(fatal|error):/.test(error)) errorOutput.push(error)
        else warningOutput.push(error)
      },
    },
  })

  for (const msg of debugOutput) core.debug(msg)
  for (const msg of warningOutput) core.warning(msg)
  for (const msg of errorOutput) core.error(msg)

  return {
    debug: debugOutput,
    warn: warningOutput,
    error: errorOutput,
  }
}

export async function switchBranch(branch: string) {
  await execGit(['checkout', '-b', branch])
}

export async function pushCurrentBranch() {
  const pushArgs = ['push', '--porcelain', '--set-upstream', 'origin', 'HEAD']
  if (core.getBooleanInput('branch-push-force')) {
    pushArgs.splice(1, 0, '--force')
  }

  await execGit(pushArgs)
}

export async function addFileChanges(globPatterns: string[]) {
  await execGit(['add', '--', ...globPatterns])
}

function processFileChanges(output: string[]) {
  const additions: FileAddition[] = []
  const deletions: FileDeletion[] = []
  for (const line of output) {
    const staged = line.charAt(0)
    const filePath = line.slice(3)
    switch (staged) {
      case 'D': {
        deletions.push({ path: filePath })
        break
      }
      case '?':
      case 'A':
      case 'M': {
        additions.push({ path: filePath, contents: '' })
        break
      }
      case 'R': {
        const [from, to] = filePath.split('->')
        deletions.push({ path: from.trim() })
        additions.push({ path: to.trim(), contents: '' })
        break
      }
    }
  }
  return { additions, deletions }
}

export async function getFileChanges(): Promise<FileChanges> {
  const { debug } = await execGit(['status', '-suno', '--porcelain'])
  const { additions, deletions } = processFileChanges(debug)
  const filesChanges: FileChanges = {}
  if (additions.length > 0) {
    filesChanges.additions = additions
  }
  if (deletions.length > 0) {
    filesChanges.deletions = deletions
  }
  return filesChanges
}
