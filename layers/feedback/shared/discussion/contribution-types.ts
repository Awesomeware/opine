export const contributionTypes = ['context', 'different_view', 'suggestion', 'question'] as const
export type ContributionType = (typeof contributionTypes)[number]
export const contributionLabels: Record<ContributionType, string> = {
  context: 'Context or example',
  different_view: 'Different view',
  suggestion: 'Suggestion',
  question: 'Question',
}
export const contributionFilterLabels: Record<ContributionType, string> = {
  context: 'Context',
  different_view: 'Different views',
  suggestion: 'Suggestions',
  question: 'Questions',
}
export const contributionPrompts: Record<ContributionType, string> = {
  context: 'What context or example would help others understand this feedback?',
  different_view: 'What do you see differently, and why?',
  suggestion: 'What would you suggest, and how would it help?',
  question: 'What would you like clarified or answered?',
}
export function isContributionType(value: unknown): value is ContributionType {
  return typeof value === 'string' && contributionTypes.includes(value as ContributionType)
}
