// Workspace documents: folder tree + encrypted uploads/downloads. Blobs are
// encrypted on the server; downloads go through the membership-checked endpoint
// (the session cookie rides along on the plain <a href>).
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Incident, IncidentFile, IncidentFolder } from '@shared/types'
import { apiUpload, useApiMutation, useIncidentFiles, useIncidentFolders, useMe } from '../../api/client'
import { ErrorNote, Loading } from '../../components/ui'

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const INVALIDATES = ['incident-files', 'incident-folders']

export function FilesPanel({ incident }: { incident: Incident }) {
  const { data: me } = useMe()
  const { data: folders, isPending: foldersPending } = useIncidentFolders(incident.incident_id)
  const { data: files, isPending: filesPending, error } = useIncidentFiles(incident.incident_id)
  const mutate = useApiMutation(INVALIDATES)
  const qc = useQueryClient()
  const [currentFolder, setCurrentFolder] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      if (currentFolder !== null) form.append('folder_id', String(currentFolder))
      return apiUpload<IncidentFile>(`/incidents/${incident.incident_id}/files`, form)
    },
    onSuccess: () =>
      Promise.all(INVALIDATES.map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  })

  const readOnly = incident.status !== 'active'
  const canWrite = !readOnly && incident.my_role !== 'observer'
  const isCommander = incident.my_role === 'commander' || Boolean(me?.is_admin)

  if (foldersPending || filesPending) return <Loading />
  if (error) return <ErrorNote error={error} />

  const subfolders = (folders ?? []).filter((f) => f.parent_folder_id === currentFolder)
  const folderFiles = (files ?? []).filter((f) => f.folder_id === currentFolder)
  const base = `/incidents/${incident.incident_id}`

  // Breadcrumb path from root to the current folder
  const crumbs: IncidentFolder[] = []
  let cursor = currentFolder
  while (cursor !== null) {
    const f = (folders ?? []).find((x) => x.folder_id === cursor)
    if (!f) break
    crumbs.unshift(f)
    cursor = f.parent_folder_id
  }

  const uploadFiles = (list: FileList | null) => {
    if (!list) return
    for (const file of Array.from(list)) uploadMutation.mutate(file)
  }

  const newFolder = () => {
    const name = prompt('Folder name:')?.trim()
    if (!name) return
    mutate.mutate({
      path: `${base}/folders`,
      method: 'POST',
      body: { name, parent_folder_id: currentFolder },
    })
  }

  const renameFolder = (f: IncidentFolder) => {
    const name = prompt('New folder name:', f.name)?.trim()
    if (!name || name === f.name) return
    mutate.mutate({ path: `${base}/folders/${f.folder_id}`, method: 'PUT', body: { name } })
  }

  return (
    <div
      onDragOver={(e) => { if (canWrite) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!canWrite) return
        e.preventDefault()
        setDragOver(false)
        uploadFiles(e.dataTransfer.files)
      }}
      className={`rounded-2xl border bg-paper p-4 ${dragOver ? 'border-accent ring-2 ring-accent' : 'border-line'}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap items-center gap-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setCurrentFolder(null)}
            className={currentFolder === null ? 'text-ink' : 'text-accent hover:underline'}
          >
            Documents
          </button>
          {crumbs.map((c) => (
            <span key={c.folder_id} className="flex items-center gap-1">
              <span className="text-steel">/</span>
              <button
                type="button"
                onClick={() => setCurrentFolder(c.folder_id)}
                className={c.folder_id === currentFolder ? 'text-ink' : 'text-accent hover:underline'}
              >
                {c.name}
              </button>
            </span>
          ))}
        </nav>
        {canWrite ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={newFolder}
              className="min-h-10 rounded-full bg-mist px-4 text-sm font-semibold hover:bg-line"
            >
              + Folder
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploadMutation.isPending}
              className="min-h-10 rounded-full bg-accent px-4 text-sm font-bold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Uploading…' : '⤒ Upload'}
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => { uploadFiles(e.target.files); e.target.value = '' }}
            />
          </div>
        ) : (
          <span className="text-sm font-semibold text-steel">
            {readOnly ? 'Read-only' : 'Observers can download only'}
          </span>
        )}
      </div>

      {(uploadMutation.isError || mutate.isError) ? (
        <p className="mb-3 rounded-lg bg-emergency-soft p-3 text-sm font-semibold text-emergency-deep">
          {((uploadMutation.error ?? mutate.error) instanceof Error)
            ? ((uploadMutation.error ?? mutate.error) as Error).message
            : 'Operation failed.'}
        </p>
      ) : null}

      {subfolders.length > 0 ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {subfolders.map((f) => (
            <div key={f.folder_id} className="flex items-center gap-2 rounded-xl bg-card p-3 shadow-card">
              <button
                type="button"
                onClick={() => setCurrentFolder(f.folder_id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold hover:text-accent"
              >
                <span aria-hidden>📁</span>
                <span className="truncate">{f.name}</span>
              </button>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => renameFolder(f)}
                  className="min-h-9 shrink-0 rounded px-2 text-xs font-semibold text-steel hover:text-ink"
                >
                  Rename
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold tracking-wide text-steel uppercase">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Size</th>
              <th className="px-4 py-2.5">Uploaded by</th>
              <th className="px-4 py-2.5">When</th>
              {isCommander && !readOnly ? <th className="px-4 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {folderFiles.map((f) => (
              <tr key={f.file_id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="max-w-72 truncate px-4 py-2.5">
                  <a
                    href={`/api${base}/files/${f.file_id}/download`}
                    className="font-semibold text-accent hover:underline"
                  >
                    {f.original_name}
                  </a>
                </td>
                <td className="tel px-4 py-2.5 whitespace-nowrap">{fmtBytes(f.size_bytes)}</td>
                <td className="max-w-40 truncate px-4 py-2.5">{f.uploader_name}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-steel">{fmtDate(f.uploaded_at)}</td>
                {isCommander && !readOnly ? (
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove “${f.original_name}”? It leaves the list but stays in the incident record.`)) {
                          mutate.mutate({ path: `${base}/files/${f.file_id}`, method: 'DELETE' })
                        }
                      }}
                      className="min-h-9 rounded px-3 text-xs font-semibold text-alarm hover:bg-alarm-soft"
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {folderFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-steel">
                  {canWrite
                    ? 'No documents here yet — drop files anywhere in this panel or use Upload.'
                    : 'No documents here.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-steel">
        Documents are encrypted at rest; every download is recorded in the incident audit trail. Max 50 MB per file.
      </p>
    </div>
  )
}
