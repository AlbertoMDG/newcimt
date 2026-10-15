// Encrypted blob storage for war-room documents. Blobs live OUTSIDE the web
// root (never served statically), named by server-generated UUID — the original
// filename only exists in dbo.incident_files.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function filesDir(): string {
  return process.env.CIMT_FILES_DIR ?? path.join(rootDir, 'server', 'private-files')
}

function blobPath(incidentId: number, storageName: string): string {
  // storageName is a server-generated "<uuid>.bin" — no user input in the path
  return path.join(filesDir(), `incident-${incidentId}`, storageName)
}

export async function writeBlob(incidentId: number, storageName: string, data: Buffer): Promise<void> {
  const target = blobPath(incidentId, storageName)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, data)
}

export async function readBlob(incidentId: number, storageName: string): Promise<Buffer> {
  return readFile(blobPath(incidentId, storageName))
}
