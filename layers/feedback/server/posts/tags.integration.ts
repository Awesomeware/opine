import { eq } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { eventLog } from '../../../../server/events/schema.ts'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import {
  applyMigrations,
  withMigrationDatabase,
} from '../../../../tests/helpers/migration-database.ts'
import { user, userRole } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { feedbackPost, feedbackTag } from '../schema.ts'
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
  await getDatabase().delete(eventLog)
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
  const input = {
    title: 'Tag feedback',
    description: 'Feedback body',
    desiredImprovement: null,
  }
  return { member, admin, input }
}
test('migration seeds optional defaults and tag administration enforces names and versions', async () => {
  const tags = await listTags()
  for (const tag of defaultFeedbackTags)
    assert.ok(
      tags.some((row) => row.id === tag.id && row.name === tag.name && row.icon === tag.icon),
    )
  const admin = await createMember({ roles: ['administrator'] })
  const created = await createTag({ name: 'New' }, admin.user.id)
  await assert.rejects(createTag({ name: 'New' }, null), status(409))
  await assert.rejects(createTag({ name: 'new' }, null), status(409))
  const unchanged = { name: 'New', isActive: true, version: 1 }
  assert.deepEqual(await updateTag(created.id, unchanged, null), created)
  const updated = await updateTag(
    created.id,
    { name: 'Renamed', isActive: false, version: 1 },
    admin.user.id,
  )
  assert.equal(updated.version, 2)
  const events = await getDatabase().select().from(eventLog)
  assert.equal(events.length, 2)
  assert.ok(events.every((event) => event.actorId === admin.user.id))
  assert.deepEqual(events.find((event) => event.eventType === 'tag.updated')!.details, {
    tagId: created.id,
    version: 2,
    changedFields: ['name', 'isActive'],
  })
  await assert.rejects(updateTag(created.id, unchanged, null), status(409))
})
test('optional tag sets save atomically with text, retain disabled assignments, clear explicitly and preserve omission', async () => {
  const { member, admin, input } = await setup()
  const ids = defaultFeedbackTags
    .slice(0, 2)
    .map((tag) => tag.id)
    .sort()
  const empty = await createPost(member.user.id, input)
  assert.deepEqual((await getPost(empty!.id))!.tags, [])
  await getDatabase()
    .update(feedbackPost)
    .set({ createdAt: new Date(Date.now() - 61_000) })
    .where(eq(feedbackPost.id, empty!.id))
  const post = await createPost(member.user.id, { ...input, tagIds: ids })
  assert.ok(post)
  assert.equal((await getPost(post.id))!.tags.length, 2)
  assert.equal((await listPosts()).posts.find((row) => row.id === post.id)!.tags.length, 2)
  await updateTag(ids[0]!, { name: 'Renamed', isActive: false, version: 1 }, null)
  const other = await createMember()
  await assert.rejects(createPost(other.user.id, { ...input, tagIds: [ids[0]!] }), status(400))
  const edit = {
    title: input.title,
    description: input.description,
    desiredImprovement: null,
    version: 1,
  }
  assert.equal((await editPost(member.user.id, post.id, { ...edit, tagIds: ids })).version, 1)
  await editPost(member.user.id, post.id, { ...edit, title: 'Updated' })
  assert.equal((await getPost(post.id))!.tags.length, 2)
  await assert.rejects(
    editPost(admin.user.id, post.id, { ...edit, version: 2, tagIds: [] }),
    status(403),
  )
  await assert.rejects(editPost(member.user.id, post.id, { ...edit, tagIds: [] }), status(409))
  const cleared = await editPost(member.user.id, post.id, {
    ...edit,
    title: 'Updated',
    version: 2,
    tagIds: [],
  })
  assert.equal(cleared.version, 3)
  const stored = await getPost(post.id)
  assert.deepEqual(stored!.tags, [])
  assert.ok(stored!.editedAt)
  await assert.rejects(
    editPost(member.user.id, post.id, {
      ...edit,
      title: 'Must roll back',
      version: 3,
      tagIds: [ids[0]!],
    }),
    status(400),
  )
  assert.equal((await getPost(post.id))!.title, 'Updated')
})
test('tag disabling and assignment serialize without attaching an already disabled tag', async () => {
  const { member, input } = await setup()
  const tag = defaultFeedbackTags[0]!
  const [publication, disabling] = await Promise.allSettled([
    createPost(member.user.id, { ...input, tagIds: [tag.id] }),
    updateTag(tag.id, { name: tag.name, isActive: false, version: 1 }, null),
  ])
  assert.equal(disabling.status, 'fulfilled')
  if (publication.status === 'rejected') assert.ok(status(400)(publication.reason))
  else assert.equal((await getPost(publication.value!.id))!.tags[0]!.isActive, false)
  const other = await createMember()
  await assert.rejects(createPost(other.user.id, { ...input, tagIds: [tag.id] }), status(400))
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
    await applyMigrations(isolated, 8, 9)
    assert.deepEqual((await isolated.query('select * from feedback_post')).rows, before)
    assert.equal((await isolated.query('select * from feedback_post_tag')).rows.length, 0)
    const tags = (await isolated.query('select id, name, icon from feedback_tag order by id')).rows
    assert.deepEqual(tags, defaultFeedbackTags)
  })
})

test('icon changes preserve omission, update projections and emit only actual changes', async () => {
  const { member, input } = await setup()
  const tag = await createTag({ name: 'Icon tag', icon: '🕹️' }, null)
  const plain = await createTag({ name: 'Plain tag' }, null)
  assert.equal((await listTags()).find((row) => row.id === plain.id)!.icon, null)
  const post = await createPost(member.user.id, { ...input, tagIds: [tag.id] })
  assert.equal((await getPost(post!.id))!.tags[0]!.icon, '🕹️')
  assert.equal((await listPosts()).posts.find((row) => row.id === post!.id)!.tags[0]!.icon, '🕹️')
  const unchanged = { name: 'Icon tag', isActive: true, version: 1 }
  assert.deepEqual(await updateTag(tag.id, unchanged, null), tag)
  assert.deepEqual(await updateTag(tag.id, { ...unchanged, icon: '🕹️' }, null), tag)
  const updated = await updateTag(tag.id, { ...unchanged, icon: '💻' }, null)
  assert.equal(updated.version, 2)
  assert.equal((await getPost(post!.id))!.tags[0]!.icon, '💻')
  await updateTag(tag.id, { ...unchanged, version: 2, icon: null }, null)
  assert.equal((await getPost(post!.id))!.tags[0]!.icon, null)
  const events = await getDatabase()
    .select()
    .from(eventLog)
    .where(eq(eventLog.eventType, 'tag.updated'))
  assert.equal(events.length, 2)
  assert.ok(events.every((event) => JSON.stringify(event.details.changedFields) === '["icon"]'))
})

test('icon migration preserves custom names, disabled tags, assignments and naming conflicts', async () => {
  await withMigrationDatabase(async (isolated) => {
    await applyMigrations(isolated, 0, 8)
    await isolated.query(
      "update feedback_tag set name = 'Custom gameplay', is_active = false where name = 'Gameplay'",
    )
    await isolated.query("update feedback_tag set is_active = false where name = 'UI'")
    await isolated.query("insert into feedback_tag (name) values ('Marketplace'), ('Items')")
    const actorId = randomUUID()
    await isolated.query('insert into auth_user (id, name, email) values ($1, $2, $3)', [
      actorId,
      'Existing',
      'icons@example.test',
    ])
    await isolated.query(
      "insert into feedback_post (author_id, category_id, title, description) select $1, id, 'Existing', 'Body' from feedback_category limit 1",
      [actorId],
    )
    await isolated.query(
      "insert into feedback_post_tag select p.id, t.id from feedback_post p cross join feedback_tag t where t.name in ('$$$', 'Class-specific')",
    )
    const assignments = (await isolated.query('select * from feedback_post_tag order by tag_id'))
      .rows
    await applyMigrations(isolated, 8, 9)
    assert.deepEqual(
      (await isolated.query('select * from feedback_post_tag order by tag_id')).rows,
      assignments,
    )
    const tags = (await isolated.query('select * from feedback_tag')).rows
    const custom = tags.find((tag) => tag.name === 'Custom gameplay')!
    assert.equal(custom.icon, null)
    assert.equal(custom.is_active, false)
    assert.equal(tags.find((tag) => tag.name === 'UI')!.is_active, false)
    assert.equal(tags.find((tag) => tag.name === 'UI')!.icon, '💻')
    assert.equal(tags.find((tag) => tag.name === '$$$')!.icon, '🛍️')
    assert.equal(tags.find((tag) => tag.name === 'Marketplace')!.icon, null)
    assert.equal(tags.find((tag) => tag.name === 'Class Specific')!.id, defaultFeedbackTags[2]!.id)
    assert.equal(tags.filter((tag) => tag.name === 'Items').length, 1)
    assert.equal(tags.find((tag) => tag.name === 'Items')!.icon, null)
  })
})
