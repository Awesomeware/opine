import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { setUserRole } from '../../../auth/server/roles.ts'
import { feedbackCategory, feedbackPost, feedbackTag } from '../../server/schema.ts'
import { createCategory } from '../fixtures.ts'

test.afterAll(closeDatabase)
const headers = (cookie?: string, key = randomUUID()) => ({
  origin: process.env.BETTER_AUTH_URL!,
  ...(cookie ? { cookie } : {}),
  'Idempotency-Key': key,
})

test('only administrators manage the optional tag catalog, while post ownership still controls attachments', async ({
  page,
  request,
}) => {
  const admin = await createMember({ roles: ['administrator'] })
  const member = await createMember()
  const manager = await createMember({ roles: ['community-manager'] })
  const category = await createCategory()
  const names = [
    `Custom tag ${randomUUID().slice(0, 8)}`,
    `Renamed tag ${randomUUID().slice(0, 8)}`,
  ]
  const database = getDatabase()
  try {
    const catalog = await request.get('/api/feedback/tags')
    expect(catalog.ok()).toBe(true)
    expect((await catalog.json()).tags.map((tag: { name: string }) => tag.name)).toEqual(
      expect.arrayContaining(['Gameplay', 'UI', 'Class-specific', 'Combat', '$$$']),
    )
    for (const [cookie, expected] of [
      [undefined, 401],
      [member.cookieHeader, 403],
      [manager.cookieHeader, 403],
    ] as const) {
      expect(
        (
          await request.post('/api/feedback/tags', {
            headers: headers(cookie),
            data: { name: names[0] },
          })
        ).status(),
      ).toBe(expected)
    }
    expect(
      (
        await request.post('/api/feedback/tags', {
          headers: { ...headers(admin.cookieHeader), origin: 'https://untrusted.example' },
          data: { name: names[0] },
        })
      ).status(),
    ).toBe(403)
    await page.context().addCookies([admin.cookie])
    await page.goto('/feedback/tags')
    await expect(page.getByRole('heading', { name: 'Manage tags', exact: true })).toBeVisible()
    await page.getByLabel('New tag name', { exact: true }).fill(names[0]!)
    await page.getByRole('button', { name: 'Create tag', exact: true }).click()
    const row = page.getByRole('region', { name: `${names[0]} tag`, exact: true })
    await expect(row).toBeVisible()
    const [tag] = await database.select().from(feedbackTag).where(eq(feedbackTag.name, names[0]!))
    expect(tag).toBeDefined()
    for (const [cookie, expected] of [
      [undefined, 401],
      [member.cookieHeader, 403],
      [manager.cookieHeader, 403],
    ] as const) {
      expect(
        (
          await request.patch(`/api/feedback/tags/${tag!.id}`, {
            headers: headers(cookie),
            data: { name: names[0], isActive: false, version: 1 },
          })
        ).status(),
      ).toBe(expected)
    }
    const created = await request.post('/api/feedback/posts', {
      headers: headers(member.cookieHeader),
      data: {
        categoryId: category.id,
        title: 'Tag ownership remains with the author',
        description: 'Categorizing this proposal is optional.',
        tagIds: [tag!.id],
      },
    })
    expect(created.status()).toBe(201)
    const postId = (await created.json()).id
    expect(
      (
        await request.patch(`/api/feedback/posts/${postId}`, {
          headers: headers(admin.cookieHeader),
          data: {
            title: 'Tag ownership remains with the author',
            description: 'Categorizing this proposal is optional.',
            desiredImprovement: null,
            version: 1,
            tagIds: [],
          },
        })
      ).status(),
    ).toBe(403)
    await row.getByLabel('Tag name', { exact: true }).fill(names[1]!)
    await row.getByLabel('Available for new selections', { exact: true }).uncheck()
    await row.getByRole('button', { name: 'Save tag', exact: true }).click()
    await expect(page.getByRole('region', { name: `${names[1]} tag`, exact: true })).toBeVisible()
    const post = (await (await request.get(`/api/feedback/posts/${postId}`)).json()).post
    expect(post.tags).toEqual([
      expect.objectContaining({ id: tag!.id, name: names[1], isActive: false }),
    ])
    const disabled = await request.post('/api/feedback/posts', {
      headers: headers(member.cookieHeader),
      data: {
        categoryId: category.id,
        title: 'Cannot attach a disabled tag',
        description: 'A new proposal',
        tagIds: [tag!.id],
      },
    })
    expect(disabled.status()).toBe(400)
    await page.context().clearCookies()
    await page.context().addCookies([member.cookie])
    await page.goto('/feedback/tags')
    await expect(page.getByRole('button', { name: 'Create tag', exact: true })).toHaveCount(0)
    await page.goto(`/feedback/${postId}`)
    await page.getByRole('button', { name: 'Edit feedback', exact: true }).click()
    const retainedTag = page.getByRole('checkbox', { name: `${names[1]} (inactive)`, exact: true })
    await expect(retainedTag).toBeChecked()
    await expect(retainedTag).toBeEnabled()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toBeVisible()
    expect((await (await request.get(`/api/feedback/posts/${postId}`)).json()).post.version).toBe(1)
    await page.getByRole('button', { name: 'Edit feedback', exact: true }).click()
    const tagError = 'Selected tag is unavailable.'
    await page.route(`**/api/feedback/posts/${postId}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      await route.fulfill({ status: 400, json: { data: { fieldErrors: { tagIds: tagError } } } })
    })
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByText(tagError, { exact: true })).toHaveCount(1)
    await page.route('**/api/feedback/tags', (route) => route.fulfill({ status: 503, json: {} }))
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Retry tags', exact: true })).toBeVisible()
    await expect(page.getByText(tagError, { exact: true })).toHaveCount(1)
    await page.unroute('**/api/feedback/tags')
    await page.getByRole('button', { name: 'Retry tags', exact: true }).click()
    await expect(retainedTag).toBeVisible()
    await expect(page.getByText(tagError, { exact: true })).toHaveCount(1)
    await page.unroute(`**/api/feedback/posts/${postId}`)
    await retainedTag.uncheck()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toBeVisible()
    expect((await (await request.get(`/api/feedback/posts/${postId}`)).json()).post.tags).toEqual(
      [],
    )
  } finally {
    await database.delete(feedbackPost).where(eq(feedbackPost.categoryId, category.id))
    await database.delete(feedbackTag).where(inArray(feedbackTag.name, names))
    await database.delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    for (const actor of [admin, member, manager]) await actor.cleanup()
  }
})

test('optional tags survive a lost submission reply while the form stays open, then author tag-only edits can clear them', async ({
  page,
  request,
}) => {
  const author = await createMember()
  const admin = await createMember({ roles: ['administrator'] })
  const category = await createCategory()
  const database = getDatabase()
  const names = [
    `Journey tag A ${randomUUID().slice(0, 8)}`,
    `Journey tag B ${randomUUID().slice(0, 8)}`,
  ]
  try {
    for (const name of names)
      expect(
        (
          await request.post('/api/feedback/tags', {
            headers: headers(admin.cookieHeader),
            data: { name },
          })
        ).status(),
      ).toBe(201)
    const tags = await database.select().from(feedbackTag).where(inArray(feedbackTag.name, names))
    expect(tags).toHaveLength(2)
    const untagged = await request.post('/api/feedback/posts', {
      headers: headers(author.cookieHeader),
      data: {
        categoryId: category.id,
        title: 'Feedback without tags',
        description: 'No tags are needed.',
      },
    })
    expect(untagged.status()).toBe(201)
    expect(
      (await (await request.get(`/api/feedback/posts/${(await untagged.json()).id}`)).json()).post
        .tags,
    ).toEqual([])
    await page.context().addCookies([author.cookie])
    await page.goto('/feedback/new')
    const picker = page.getByRole('group', { name: 'Tags (optional)', exact: true })
    await expect(picker.getByRole('checkbox', { checked: true })).toHaveCount(0)
    await page
      .getByLabel('Title', { exact: true })
      .fill('Make navigation clearer with optional tags')
    await page.getByLabel('Feedback', { exact: true }).fill('The map labels are too small.')
    await page.getByLabel('Category', { exact: true }).selectOption(category.id)
    for (const name of names) await picker.getByRole('checkbox', { name, exact: true }).check()
    await page.route('**/api/feedback/posts', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      expect((await route.fetch()).status()).toBe(201)
      await route.abort('failed')
    })
    await page.getByRole('button', { name: 'Submit feedback', exact: true }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Unable to confirm submission',
    )
    await page.unroute('**/api/feedback/posts')
    await page.getByRole('button', { name: 'Submit feedback', exact: true }).click()
    await page.waitForURL(/\/feedback\/[0-9a-f-]{36}$/)
    const postId = new URL(page.url()).pathname.split('/').at(-1)!
    expect(
      await database
        .select()
        .from(feedbackPost)
        .where(eq(feedbackPost.title, 'Make navigation clearer with optional tags')),
    ).toHaveLength(1)
    const getPost = async () =>
      (await (await request.get(`/api/feedback/posts/${postId}`)).json()).post
    expect((await getPost()).tags.map((tag: { id: string }) => tag.id).sort()).toEqual(
      tags.map((tag) => tag.id).sort(),
    )
    await page.getByRole('button', { name: 'Edit feedback', exact: true }).click()
    await picker.getByRole('checkbox', { name: names[0], exact: true }).uncheck()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toBeVisible()
    const edited = await getPost()
    expect(edited.version).toBe(2)
    expect(edited.editedAt).not.toBeNull()
    expect(edited.tags.map((tag: { name: string }) => tag.name)).toEqual([names[1]])
    await page.getByRole('button', { name: 'Edit feedback', exact: true }).click()
    await picker.getByRole('checkbox', { name: names[1], exact: true }).uncheck()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toBeVisible()
    expect((await getPost()).tags).toEqual([])
    expect((await getPost()).version).toBe(3)
    const current = await getPost()
    expect(
      (
        await request.patch(`/api/feedback/posts/${postId}`, {
          headers: headers(author.cookieHeader),
          data: {
            title: current.title,
            description: current.description,
            desiredImprovement: current.desiredImprovement,
            version: 3,
            tagIds: tags.map((tag) => tag.id),
          },
        })
      ).status(),
    ).toBe(200)
  } finally {
    await database.delete(feedbackPost).where(eq(feedbackPost.categoryId, category.id))
    await database.delete(feedbackTag).where(inArray(feedbackTag.name, names))
    await database.delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await author.cleanup()
    await admin.cleanup()
  }
})

test('a confirmed tag edit survives catalog refresh failure without repeating the mutation', async ({
  page,
  request,
}) => {
  const admin = await createMember({ roles: ['administrator'] })
  const database = getDatabase()
  const suffix = randomUUID().slice(0, 8)
  const names = [`Refresh initial ${suffix}`, `Refresh saved ${suffix}`, `Refresh next ${suffix}`]
  const versions: number[] = []
  let failCatalog = false
  let catalogReads = 0

  try {
    const created = await request.post('/api/feedback/tags', {
      headers: headers(admin.cookieHeader),
      data: { name: names[0] },
    })
    expect(created.status()).toBe(201)
    const [tag] = await database.select().from(feedbackTag).where(eq(feedbackTag.name, names[0]!))
    expect(tag).toBeDefined()

    await page.route(`**/api/feedback/tags/${tag!.id}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        versions.push(route.request().postDataJSON().version)
      }
      await route.continue()
    })
    await page.route('**/api/feedback/tags', async (route) => {
      catalogReads++
      if (failCatalog) {
        await route.fulfill({ status: 400, json: { message: 'Catalog unavailable' } })
      } else {
        await route.continue()
      }
    })

    await page.context().addCookies([admin.cookie])
    await page.goto('/feedback/tags')
    const row = page.getByRole('region', { name: `${names[0]} tag`, exact: true })
    const nameInput = row.getByLabel('Tag name', { exact: true })
    await expect(nameInput).toHaveValue(names[0]!)

    failCatalog = true
    await nameInput.fill(names[1]!)
    await row.getByRole('button', { name: 'Save tag', exact: true }).click()
    await expect(row.getByText('Tag saved.', { exact: true })).toBeVisible()
    await expect(row.getByRole('alert')).toHaveCount(0)
    await expect(
      page.getByText('Unable to load tag management. Please retry.', { exact: false }),
    ).toBeVisible()
    await expect(nameInput).toBeEditable()
    await expect(row.getByLabel('Available for new selections')).toBeEnabled()
    await expect(row.getByRole('button', { name: 'Save tag', exact: true })).toBeEnabled()
    expect(versions).toEqual([1])

    const [saved] = await database.select().from(feedbackTag).where(eq(feedbackTag.id, tag!.id))
    expect(saved).toMatchObject({ name: names[1], version: 2 })

    expect(catalogReads).toBe(2)
    failCatalog = false

    await nameInput.fill(names[2]!)
    await row.getByRole('button', { name: 'Save tag', exact: true }).click()
    await expect(page.getByRole('region', { name: `${names[2]} tag`, exact: true })).toBeVisible()
    expect(versions).toEqual([1, 2])
    const [updated] = await database.select().from(feedbackTag).where(eq(feedbackTag.id, tag!.id))
    expect(updated).toMatchObject({ name: names[2], version: 3 })
  } finally {
    await database.delete(feedbackTag).where(inArray(feedbackTag.name, names))
    await admin.cleanup()
  }
})

test('tag retries authorize again after administrator access is revoked', async ({ request }) => {
  const admin = await createMember({ roles: ['administrator'] })
  const name = `Role retry ${randomUUID().slice(0, 8)}`
  try {
    const options = { headers: headers(admin.cookieHeader), data: { name } }
    expect((await request.post('/api/feedback/tags', options)).status()).toBe(201)
    await setUserRole(admin.user.id, 'administrator', false)
    expect((await request.post('/api/feedback/tags', options)).status()).toBe(403)
    // Input validation precedes authentication, even for an unauthenticated caller.
    expect((await request.post('/api/feedback/tags', { data: { name: '' } })).status()).toBe(400)
  } finally {
    await getDatabase().delete(feedbackTag).where(eq(feedbackTag.name, name))
    await admin.cleanup()
  }
})
