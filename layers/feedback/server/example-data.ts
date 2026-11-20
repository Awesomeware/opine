import { sql } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { user, userRole } from '../../auth/server/schema.ts'
import type { ContributionType } from '../shared/contribution-types.ts'
import type { PostStatus } from '../shared/status.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackFollow,
  feedbackNotification,
  feedbackOfficialResponse,
  feedbackPost,
  feedbackReaction,
} from './schema.ts'

// Reserved identifiers let repeated runs preserve existing examples and user edits.
function exampleId(number: number) {
  return `eea00000-0000-4000-8000-${number.toString().padStart(12, '0')}`
}
export const examplePostIds = [exampleId(1), exampleId(2), exampleId(3)] as const
const players = ['opine-example-alex', 'opine-example-sam', 'opine-example-riley'] as const
const manager = 'opine-example-morgan'
const categories = [
  { id: exampleId(10), slug: 'example-interface', name: 'Interface (example)' },
  { id: exampleId(11), slug: 'example-gameplay', name: 'Gameplay (example)' },
]
type ExampleComment = { type: ContributionType; body: string }
type ExampleResponse = { body: string; status?: PostStatus }
const examples: {
  title: string
  description: string
  desiredImprovement: string
  categoryId: string
  comments: ExampleComment[]
  responses: ExampleResponse[]
}[] = [
  {
    title: 'Keep the inventory filters when reopening the backpack',
    description:
      'I often switch between crafting and my backpack. Each time I reopen it, the selected item category resets, so finding the same materials takes several extra clicks.',
    desiredImprovement:
      'Remember the last selected inventory filter for the current play session, with a clear way to return to all items.',
    categoryId: categories[0]!.id,
    comments: [
      {
        type: 'context',
        body: 'This happens most when preparing several potions at the workbench. I reopen the ingredients tab after every recipe.',
      },
      {
        type: 'different_view',
        body: 'I like seeing all items when I open the backpack during exploration. Could remembering the filter be an option?',
      },
      {
        type: 'suggestion',
        body: 'Keep the filter, but show its name beside the backpack heading and add an obvious Clear filter button.',
      },
      {
        type: 'question',
        body: 'Should the search text also be remembered, or just the item category?',
      },
    ],
    responses: [
      {
        status: 'reviewing',
        body: 'We have acknowledged this and are reviewing how persistent filters affect crafting and exploration. The examples here help us compare both uses.',
      },
      {
        body: 'A quick follow-up: our first prototype keeps the category but clears search text. We are still reviewing the interaction; this is not a delivery commitment.',
      },
    ],
  },
  {
    title: 'Make objective markers distinguishable without relying on color',
    description:
      'The active quest and optional objectives use similar marker shapes. In a busy area, the color difference alone makes it difficult to identify which marker to follow.',
    desiredImprovement:
      'Give active quests and optional objectives distinct marker shapes, and include a small legend in the map.',
    categoryId: categories[0]!.id,
    comments: [
      {
        type: 'context',
        body: 'In the snowy region the markers also blend into the background. A contrasting outline would help.',
      },
      {
        type: 'suggestion',
        body: 'A diamond for the active quest and a circle for optional objectives would be easy to explain in a legend.',
      },
      {
        type: 'question',
        body: 'Will the new shapes appear on the compass as well as the full map?',
      },
    ],
    responses: [
      {
        status: 'planned',
        body: 'Distinct objective shapes and stronger outlines are planned for both the map and compass. We will share timing after the accessibility review; there is no release date yet.',
      },
    ],
  },
  {
    title: 'Let co-op groups practise boss encounters without spending a key',
    description:
      'Our group would like to learn boss mechanics together, but spending an entry key on each attempt discourages experimentation, especially when introducing a new player.',
    desiredImprovement:
      'Offer a practice version with no entry cost and no rewards, clearly separated from the regular encounter.',
    categoryId: categories[1]!.id,
    comments: [
      {
        type: 'different_view',
        body: 'Learning under pressure is part of the fun for our group. I would support an optional practice mode if regular attempts still feel worthwhile.',
      },
    ],
    responses: [],
  },
]

/** Add examples without overwriting existing posts, people, categories, or roles. */
export async function seedExampleData() {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('opine-example-data'))`)
    const now = Date.now()
    const at = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000)
    const createdUsers = await transaction
      .insert(user)
      .values([
        ...players.map((id, index) => ({
          id,
          name: `${['Alex', 'Sam', 'Riley'][index]} (example)`,
          email: `${id}@example.invalid`,
          createdAt: at(96),
          updatedAt: at(96),
        })),
        {
          id: manager,
          name: 'Morgan (example)',
          email: `${manager}@example.invalid`,
          createdAt: at(96),
          updatedAt: at(96),
        },
      ])
      .onConflictDoNothing()
      .returning({ id: user.id })
    // No login credentials are created; existing role changes remain untouched.
    if (createdUsers.some(({ id }) => id === manager)) {
      await transaction.insert(userRole).values({ userId: manager, role: 'community-manager' })
    }
    await transaction
      .insert(feedbackCategory)
      .values(categories.map((category) => ({ ...category, createdAt: at(96), updatedAt: at(96) })))
      .onConflictDoNothing()

    let createdPosts = 0
    for (const [index, example] of examples.entries()) {
      const postId = examplePostIds[index]!
      const hoursAgo = 72 - index * 12
      const status = example.responses.findLast((response) => response.status)?.status ?? 'new'
      const [post] = await transaction
        .insert(feedbackPost)
        .values({
          id: postId,
          authorId: players[index]!,
          categoryId: example.categoryId,
          title: example.title,
          description: example.description,
          desiredImprovement: example.desiredImprovement,
          status,
          workflowVersion: 1 + example.responses.length,
          createdAt: at(hoursAgo),
          updatedAt: at(hoursAgo - example.comments.length - example.responses.length),
        })
        .onConflictDoNothing()
        .returning({ id: feedbackPost.id })
      // Treat each post and its participation as one example; never replenish edited data.
      if (!post) continue
      createdPosts++
      await transaction
        .insert(feedbackFollow)
        .values(players.map((userId) => ({ postId, userId, createdAt: at(hoursAgo) })))
      await transaction.insert(feedbackComment).values(
        example.comments.map((comment, commentIndex) => ({
          id: exampleId(100 + index * 10 + commentIndex),
          postId,
          authorId: players[(index + commentIndex + 1) % players.length]!,
          ...comment,
          createdAt: at(hoursAgo - commentIndex - 1),
        })),
      )
      await transaction.insert(feedbackReaction).values(
        players.map((userId, playerIndex) => ({
          postId,
          userId,
          kind: playerIndex === 2 ? ('disagree' as const) : ('agree' as const),
          createdAt: at(hoursAgo - 1),
          updatedAt: at(hoursAgo - 1),
        })),
      )
      let previousStatus: PostStatus = 'new'
      for (const [responseIndex, response] of example.responses.entries()) {
        const responseId = exampleId(200 + index * 10 + responseIndex)
        const createdAt = at(hoursAgo - example.comments.length - responseIndex - 1)
        await transaction.insert(feedbackOfficialResponse).values({
          id: responseId,
          postId,
          authorId: manager,
          body: response.body,
          previousStatus: response.status ? previousStatus : null,
          status: response.status ?? null,
          createdAt,
        })
        if (response.status) previousStatus = response.status
        await transaction.insert(feedbackNotification).values(
          players.map((userId, playerIndex) => ({
            id: exampleId(300 + index * 100 + responseIndex * 10 + playerIndex),
            userId,
            responseId,
            createdAt,
          })),
        )
      }
    }
    return { createdPosts }
  })
}
