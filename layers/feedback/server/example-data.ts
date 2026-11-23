import { and, eq, inArray, sql } from 'drizzle-orm'
import { defaultFeedbackTags } from './posts/tags.ts'
import { getDatabase } from '../../../server/db/index.ts'
import { user, userRole } from '../../auth/server/schema.ts'
import type { ContributionType } from '../shared/discussion/contribution-types.ts'
import type { PostStatus } from '../shared/status.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackFollow,
  feedbackNotification,
  feedbackOfficialResponse,
  feedbackPost,
  feedbackTag,
  feedbackPostTag,
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
  tagNames: string[]
  comments: ExampleComment[]
  responses: ExampleResponse[]
}[] = [
  {
    tagNames: ['UI'],
    title: '[Example] Preview all gear effects before committing an upgrade',
    description:
      'Fictional EQ: Legends feedback: with gear upgrades and swappable focus, click and proc effects, I would like to compare the complete result before deciding which item to invest in.',
    desiredImprovement:
      'Show the current and proposed item side by side, including every effect and the upgrade level, before confirming a change.',
    categoryId: categories[0]!.id,
    comments: [
      {
        type: 'context',
        body: 'For a character mixing melee and spellcasting, the effects can matter as much as the raw stats. A combined comparison would help me weigh both.',
      },
      {
        type: 'different_view',
        body: 'I would prefer a compact default view. Showing every effect at once could make a straightforward upgrade harder to read.',
      },
      {
        type: 'suggestion',
        body: 'Start with the differences and offer an Expand all effects option for a detailed comparison.',
      },
      {
        type: 'question',
        body: 'Could the comparison distinguish a focus effect from an activated click effect and a combat proc?',
      },
    ],
    responses: [
      {
        status: 'reviewing',
        body: 'Fictional example response, not an EQ: Legends team statement: we are reviewing a comparison layout that keeps upgrade levels and effect changes together.',
      },
      {
        body: 'Fictional example follow-up: the proposed layout would show changes first, with full item details available on demand. This demonstrates a follow-up without changing the post status.',
      },
    ],
  },
  {
    tagNames: ['UI', 'Class Specific'],
    title: '[Example] Make ability origins clear in three-class builds',
    description:
      'Fictional EQ: Legends feedback: a character can combine up to three active classes. When planning a build, I would like to quickly understand which class contributes each spell or ability.',
    desiredImprovement:
      'Offer readable class labels and filters in ability lists, without relying on class colors alone or cluttering combat hotbars.',
    categoryId: categories[0]!.id,
    comments: [
      {
        type: 'context',
        body: 'When trying a new class combination, I would use the labels to learn where my healing, control and damage options come from.',
      },
      {
        type: 'suggestion',
        body: 'Keep class names in tooltips and detailed lists, with an optional small badge for players who want it on the hotbar.',
      },
      {
        type: 'question',
        body: 'How would the labels explain abilities that overlap between the selected classes?',
      },
    ],
    responses: [
      {
        status: 'planned',
        body: 'Fictional example response, not an EQ: Legends roadmap commitment: class labels and filters are marked planned here to demonstrate how an official status update appears in Opine.',
      },
    ],
  },
  {
    tagNames: ['Gameplay', 'Combat'],
    title: '[Example] Add an optional preparation checklist for eight-player raids',
    description:
      'Fictional EQ: Legends feedback: with raids of up to eight players and flexible class combinations, our group would like a quick way to coordinate healing, control and other responsibilities before an encounter.',
    desiredImprovement:
      'Let players share a small, optional readiness checklist with notes about their intended role. Keep it separate from encounter rewards and avoid enforcing a particular party composition.',
    categoryId: categories[1]!.id,
    comments: [
      {
        type: 'different_view',
        body: 'Our group prefers to sort this out in chat. I would welcome an optional checklist, provided it does not become a mandatory role assignment screen.',
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
      // Only tag newly inserted examples; respect renamed/disabled catalog entries and edits.
      const tagIds = defaultFeedbackTags
        .filter((tag) => example.tagNames.includes(tag.name))
        .map((tag) => tag.id)
      const tags = await transaction
        .select({ id: feedbackTag.id })
        .from(feedbackTag)
        .where(and(inArray(feedbackTag.id, tagIds), eq(feedbackTag.isActive, true)))
        .orderBy(feedbackTag.id)
        .for('share')
      if (tags.length)
        await transaction
          .insert(feedbackPostTag)
          .values(tags.map((tag) => ({ postId, tagId: tag.id })))
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
