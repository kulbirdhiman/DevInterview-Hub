import { test, expect, type Page } from '@playwright/test'
import { build } from 'esbuild'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Resume } from '../lib/api'

let server: Server
let directory: string
let origin: string

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'resume-browser-'))
  await build({ entryPoints: [resolve('test/fixtures/resume-editor.tsx')], outfile: join(directory, 'bundle.js'), bundle: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', 'process.env.NEXT_PUBLIC_API_URL': '"http://localhost:5001"' }, plugins: [{ name: 'test-only-clerk', setup(build) {
    build.onResolve({ filter: /^@clerk\/nextjs$/ }, () => ({ path: 'clerk-stub', namespace: 'test-only' }))
    build.onLoad({ filter: /.*/, namespace: 'test-only' }, () => ({ contents: 'const getToken = async () => "test-token"; export const useAuth = () => ({getToken});' }))
  } }] })
  const bundle = await readFile(join(directory, 'bundle.js'))
  server = createServer((request, response) => {
    if (request.url === '/bundle.js') { response.setHeader('content-type', 'text/javascript'); response.end(bundle) }
    else { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>') }
  }).listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
test.beforeEach(async ({ page }) => { page.on('pageerror', error => console.error('Browser error:', error.message)) })

test.afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()))
  if (directory) await rm(directory, { recursive: true })
})

async function api(page: Page, delay = 0) {
  let resume: Resume | undefined
  const saves: { expectedRevision: number; content: Resume }[] = []
  let conflict = false
  let active = 0, maximumConcurrent = 0
  const versions: { _id: string; label: string; createdAt: string; sourceRevision: number; snapshot: Resume }[] = []
  await page.route('http://localhost:5001/api/resumes/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { 'access-control-allow-origin': '*' }
    const reply = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET, PUT, POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type' } })
    if (request.method() === 'GET' && path.endsWith('/versions')) return reply({ versions: versions.map(version => ({ _id: version._id, label: version.label, createdAt: version.createdAt, sourceRevision: version.sourceRevision })) })
    if (request.method() === 'PUT') {
      const body = request.postDataJSON()
      saves.push(body); active++; maximumConcurrent = Math.max(maximumConcurrent, active)
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      active--
      if (conflict || (resume && body.expectedRevision !== resume.revision)) return reply({ message: 'This resume changed in another tab.' }, 409)
      resume = { ...body.content, _id: '123456789012345678901234', revision: body.expectedRevision + 1, versionCount: versions.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      return reply({ resume })
    }
    if (request.method() === 'POST' && path.endsWith('/versions')) {
      const body = request.postDataJSON()
      versions.unshift({ _id: String(versions.length + 1), label: body.label, createdAt: new Date().toISOString(), sourceRevision: resume!.revision, snapshot: structuredClone(resume!) })
      resume = { ...resume!, revision: resume!.revision + 1, versionCount: versions.length }
      return reply({ resume }, 201)
    }
    if (request.method() === 'POST' && path.endsWith('/restore')) {
      const versionId = path.split('/').at(-2)
      const snapshot = versions.find(version => version._id === versionId)!.snapshot
      resume = { ...structuredClone(snapshot), revision: resume!.revision + 1, versionCount: versions.length + 1 }
      return reply({ resume })
    }
    if (request.method() === 'GET') return reply({ resume })
    return reply({ message: 'Unexpected test request' }, 500)
  })
  return { saves, getResume: () => resume!, maximumConcurrent: () => maximumConcurrent, forceConflict: () => { conflict = true } }
}

test('edits during an in-flight autosave persist afterward without overwriting the new draft', async ({ page }) => {
  const backend = await api(page, 1000)
  await page.goto(origin)
  await page.getByLabel('Full name', { exact: true }).fill('First saved name')
  await expect.poll(() => backend.saves.length).toBe(1)
  await page.getByLabel('Full name', { exact: true }).fill('Final name typed while saving')
  await page.getByRole('button', { name: 'Save now', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible({ timeout: 10000 })
  expect(backend.getResume().fullName).toBe('Final name typed while saving')
  expect(backend.saves.map(save => save.expectedRevision)).toEqual([0, 1])
  expect(backend.maximumConcurrent()).toBe(1)
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Final name typed while saving')
})

test('custom sections, keyboard reorder, versions and restoration preserve content', async ({ page }) => {
  const backend = await api(page)
  await page.goto(origin)
  await page.getByRole('button', { name: 'Add custom section (0/5)' }).click()
  await page.getByLabel('Section title', { exact: true }).fill('Volunteering')
  await page.getByLabel('Section content', { exact: true }).fill('Taught a community workshop.')
  await page.getByRole('button', { name: 'Move Volunteering up', exact: true }).click()
  await page.getByLabel('Version label', { exact: true }).fill('Before tailoring')
  await page.getByRole('button', { name: 'Save version (0/30)' }).click()
  await expect(page.getByText('Before tailoring', { exact: true })).toBeVisible()
  expect(backend.getResume().customSections[0].body).toBe('Taught a community workshop.')
  expect(backend.getResume().sectionOrder.at(-2)).toContain('custom:')
  await page.getByLabel('Section content', { exact: true }).fill('A later edit')
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('button', { name: 'Volunteering', exact: true }).click()
  await expect(page.getByLabel('Section content', { exact: true })).toHaveValue('Taught a community workshop.')
})

test('conflicts pause autosave while preserving the candidate draft', async ({ page }) => {
  const backend = await api(page)
  backend.forceConflict()
  await page.goto(origin)
  await page.getByLabel('Full name', { exact: true }).fill('Unsaved candidate name')
  await expect(page.getByText('Conflict — autosave paused', { exact: true })).toBeVisible()
  await page.getByLabel('Full name', { exact: true }).fill('Still preserved after conflict')
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Still preserved after conflict')
  await expect(page.getByRole('button', { name: 'Reload saved resume', exact: true })).toBeVisible()
  expect(backend.saves).toHaveLength(1)
})


test('all core entries and drag reordering survive layout changes', async ({ page }) => {
  const backend = await api(page)
  await page.goto(origin)
  for (const [section, fields] of [
    ['Experience', [['Role', 'Developer'], ['Employer', 'Example'], ['Responsibilities and impact (one bullet per line)', 'Built internal tools.\nImproved deployment documentation.']]],
    ['Projects', [['Project name', 'Career tracker'], ['Description', 'Built a career preparation tool.'], ['Technologies (comma separated)', 'React,TypeScript']]],
    ['Education', [['Institution', 'Example College'], ['Qualification', 'BSc']]],
    ['Certifications', [['Certification', 'Cloud fundamentals'], ['Issuer', 'Example Training']]],
    ['Achievements', [['Achievement', 'Community mentor'], ['Description', 'Mentored peers.']]],
  ] as const) {
    await page.getByRole('button', { name: section, exact: true }).click()
    await page.getByRole('button', { name: 'Add entry', exact: true }).click()
    for (const [label, value] of fields) await page.getByLabel(label, { exact: true }).fill(value)
  }
  await page.getByRole('button', { name: 'Drag Projects to reorder; keyboard users can use arrow buttons', exact: true }).dragTo(page.getByRole('button', { name: 'Experience', exact: true }))
  await page.getByLabel('Template', { exact: true }).selectOption('minimal')
  await page.getByLabel('Font family', { exact: true }).selectOption('serif')
  await page.getByLabel('Accent color', { exact: true }).selectOption('burgundy')
  await page.getByRole('button', { name: 'Save now', exact: true }).click()
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible()
  const saved = backend.getResume()
  expect(saved.experience[0].bullets).toHaveLength(2)
  expect(saved.projects[0].name).toBe('Career tracker')
  expect(saved.education[0].degree).toBe('BSc')
  expect(saved.certifications[0].name).toBe('Cloud fundamentals')
  expect(saved.achievements[0].title).toBe('Community mentor')
  expect(saved.sectionOrder.slice(0, 3)).toEqual(['summary', 'projects', 'experience'])
  expect(saved.presentation).toMatchObject({ template: 'minimal', font: 'serif', color: 'burgundy' })
})
