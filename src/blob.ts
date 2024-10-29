import * as core from '@actions/core'
import * as fs from 'node:fs'
import { Buffer } from 'node:buffer'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { FileAddition } from '@octokit/graphql-schema'

import { getCwd, getWorkspace } from './utils/cwd'
import Base64Encoder from './stream/base64-encoder'

export class Blob {
  // Used for content access
  absolutePath: string
  // Returned as a property of FileChange object
  path: string

  constructor(path: string) {
    const cwd = getCwd()
    const workspace = getWorkspace()

    if (cwd === workspace || cwd.includes(workspace)) {
      this.absolutePath = path.startsWith(cwd) ? path : join(cwd, path)
      this.path = path.startsWith(cwd)
        ? path.replace(new RegExp(cwd, 'g'), '')
        : path
    } else {
      this.absolutePath = join(cwd, workspace, path)
      this.path = path.startsWith(workspace)
        ? path.replace(new RegExp(workspace, 'g'), '')
        : path
    }
    core.debug(
      'Blob.constructor() - this.absolutePath: ' +
        JSON.stringify(this.absolutePath)
    )
    core.debug('Blob.constructor() - this.path: ' + JSON.stringify(this.path))
  }

  get streamable(): Readable {
    if (!fs.existsSync(this.absolutePath)) {
      throw new Error(`File does not exist, path: ${this.absolutePath}`)
    }

    return fs
      .createReadStream(this.absolutePath, { encoding: 'utf8' })
      .pipe(new Base64Encoder())
  }

  async load(): Promise<FileAddition> {
    const chunks: Buffer[] = []
    const stream = this.streamable

    stream.on('data', (chunk) => {
      if (Buffer.isBuffer(chunk)) chunks.push(chunk)
      else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk))

      core.debug(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Blob.load() - filepath ${this.absolutePath}, received blob: ${chunk}`
      )
    })

    stream.on('error', (err) => {
      throw new Error(
        `Read file failed, error: ${err.message}, path: ${this.absolutePath}`
      )
    })

    await finished(stream)

    const content = Buffer.concat(chunks).toString('utf-8')
    return { path: this.path, contents: content }
  }
}

const createStream = (filePath: string) => new Blob(filePath)

export function getBlob(filePath: string): Blob
export function getBlob(filePath: string[]): Blob[]
export function getBlob(filePath: unknown): unknown {
  if (Array.isArray(filePath)) {
    return filePath.map(createStream)
  } else if (typeof filePath === 'string') {
    return createStream(filePath)
  }
}
