import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import {
  applyMigrations,
  withMigrationDatabase,
} from '../../../../tests/helpers/migration-database.ts'
import { setUserRole } from '../../../auth/server/roles.ts'
import { user, userRole } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createCategory } from '../../tests/fixtures.ts'
import { feedbackCategory, feedbackPost, feedbackTag, feedbackWriteReceipt } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { createPost } from './creation.ts'
import { editPost } from './editing.ts'
import { getPost, listPosts } from './queries.ts'
import { createTag, defaultFeedbackTags, listTags, updateTag } from './tags.ts'
assert.ok(process.env.OPINE_TEST_DATABASE_URL)
assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)
after(closeDatabase)
afterEach(async () => {
  await getDatabase().delete(feedbackPost)
  await getDatabase().delete(feedbackCategory)
  await getDatabase().delete(user)
  await getDatabase().delete(feedbackTag)
  await getDatabase().insert(feedbackTag).values(defaultFeedbackTags)
})
const status = (code: number) => (error: unknown) =>
  error instanceof FeedbackWriteError && error.statusCode === code
async function setup() {
  const member = await createMember()
  const admin = await createMember()
  await getDatabase().insert(userRole).values({ userId: admin.user.id, role: 'administrator' })
  const category = await createCategory()
  const input = {
    title: 'Tag feedback',
    description: 'Feedback body',
    desiredImprovement: null,
    categoryId: category.id,
  }
  return { member, admin, input }
}
test('migration seeds optional defaults and tag administration enforces roles, names, versions and replay', async () => {
  const { member, admin } = await setup()
  const tags = await listTags()
  for (const tag of defaultFeedbackTags)
    assert.ok(tags.some((row) => row.id === tag.id && row.name === tag.name))
  await assert.rejects(createTag(member.user.id, { name: 'New' }, randomUUID()), status(403))
  const key = randomUUID()
  const created = await createTag(admin.user.id, { name: 'New' }, key)
  assert.deepEqual(await createTag(admin.user.id, { name: 'New' }, key), created)
  await assert.rejects(createTag(admin.user.id, { name: 'new' }, randomUUID()), status(409))
  await assert.rejects(createTag(admin.user.id, { name: 'Other' }, key), status(409))
  await updateTag(
    admin.user.id,
    created.id,
    { name: 'Renamed', isActive: false, version: 1 },
    randomUUID(),
  )
  await assert.rejects(
    updateTag(admin.user.id, created.id, { name: 'Old', isActive: true, version: 1 }, randomUUID()),
    status(409),
  )
  await setUserRole(admin.user.id, 'administrator', false)
  await assert.rejects(createTag(admin.user.id, { name: 'New' }, key), status(403))
})
test('optional tag sets save atomically with text, retain disabled assignments, clear explicitly and preserve omission', async () => {
  const { member, admin, input } = await setup()
  const ids = defaultFeedbackTags
    .slice(0, 2)
    .map((tag) => tag.id)
    .sort()
  const empty = await createPost(member.user.id, input)
  assert.deepEqual((await getPost(empty!.id))!.tags, [])
  const key = randomUUID()
  const post = await createPost(member.user.id, { ...input, tagIds: ids }, key)
  assert.ok(post)
  assert.equal((await getPost(post.id))!.tags.length, 2)
  assert.equal((await listPosts()).posts.find((row) => row.id === post.id)!.tags.length, 2)
  await updateTag(
    admin.user.id,
    ids[0]!,
    { name: 'Renamed', isActive: false, version: 1 },
    randomUUID(),
  )
  assert.deepEqual(await createPost(member.user.id, { ...input, tagIds: ids }, key), post)
  await assert.rejects(createPost(member.user.id, { ...input, tagIds: [ids[0]!] }), status(400))
  const edit = {
    title: input.title,
    description: input.description,
    desiredImprovement: null,
    version: 1,
  }
  assert.equal(
    (await editPost(member.user.id, post.id, { ...edit, tagIds: ids }, randomUUID())).version,
    1,
  )
  await editPost(member.user.id, post.id, { ...edit, title: 'Updated' }, randomUUID())
  assert.equal((await getPost(post.id))!.tags.length, 2)
  await assert.rejects(
    editPost(admin.user.id, post.id, { ...edit, version: 2, tagIds: [] }, randomUUID()),
    status(403),
  )
  await assert.rejects(
    editPost(member.user.id, post.id, { ...edit, tagIds: [] }, randomUUID()),
    status(409),
  )
  const cleared = await editPost(
    member.user.id,
    post.id,
    { ...edit, title: 'Updated', version: 2, tagIds: [] },
    randomUUID(),
  )
  assert.equal(cleared.version, 3)
  const stored = await getPost(post.id)
  assert.deepEqual(stored!.tags, [])
  assert.ok(stored!.editedAt)
  await assert.rejects(
    editPost(
      member.user.id,
      post.id,
      { ...edit, title: 'Must roll back', version: 3, tagIds: [ids[0]!] },
      randomUUID(),
    ),
    status(400),
  )
  assert.equal((await getPost(post.id))!.title, 'Updated')
})
test('pre-tag create and edit receipts replay without changing assigned tags', async () => {
  const { member, input } = await setup()
  const post = await createPost(member.user.id, { ...input, tagIds: [defaultFeedbackTags[0]!.id] })
  assert.ok(post)
  const edit = {
    title: input.title,
    description: input.description,
    desiredImprovement: null,
    version: 1,
  }
  for (const [operation, receiptInput, result] of [
    ['create-post', input, { id: post.id }],
    ['edit-post', { postId: post.id, ...edit }, { id: post.id, version: 1 }],
  ] as const) {
    const requestId = randomUUID()
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ operation, input: receiptInput }))
      .digest('hex')
    await getDatabase()
      .insert(feedbackWriteReceipt)
      .values({ actorId: member.user.id, requestId, operation, requestHash, result })
    const replay: { id: string; version?: number } | null =
      operation === 'create-post'
        ? await createPost(member.user.id, input, requestId)
        : await editPost(member.user.id, post.id, edit, requestId)
    assert.deepEqual(replay, result)
  }
  assert.equal((await getPost(post.id))!.tags.length, 1)
})
test('tag disabling and assignment serialize without attaching an already disabled tag', async () => {
  const { member, admin, input } = await setup()
  const tag = defaultFeedbackTags[0]!
  const [publication, disabling] = await Promise.allSettled([
    createPost(member.user.id, { ...input, tagIds: [tag.id] }),
    updateTag(admin.user.id, tag.id, { name: tag.name, isActive: false, version: 1 }, randomUUID()),
  ])
  assert.equal(disabling.status, 'fulfilled')
  if (publication.status === 'rejected') assert.ok(status(400)(publication.reason))
  else assert.equal((await getPost(publication.value!.id))!.tags[0]!.isActive, false)
  await assert.rejects(createPost(member.user.id, { ...input, tagIds: [tag.id] }), status(400))
  const [disabled] = await getDatabase()
    .select()
    .from(feedbackTag)
    .where(eq(feedbackTag.id, tag.id))
  assert.equal(disabled!.isActive, false)
})

test('tag migration leaves existing post content and versions untouched with no assigned tags', async () => {
  await withMigrationDatabase(async (isolated) => {
    await applyMigrations(isolated, 0, 5)
    const actorId = randomUUID()
    await isolated.query('insert into auth_user (id, name, email) values ($1, $2, $3)', [
      actorId,
      'Existing author',
      'tags-upgrade@example.test',
    ])
    await isolated.query(
      "insert into feedback_post (author_id, category_id, title, description, version) select $1, id, 'Existing post', 'Unchanged content', 3 from feedback_category limit 1",
      [actorId],
    )
    const before = (await isolated.query('select * from feedback_post')).rows
    await applyMigrations(isolated, 5, 6)
    assert.deepEqual((await isolated.query('select * from feedback_post')).rows, before)
    assert.equal((await isolated.query('select * from feedback_post_tag')).rows.length, 0)
    const tags = (await isolated.query('select id, name from feedback_tag order by id')).rows
    assert.deepEqual(tags, defaultFeedbackTags)
  })
})
