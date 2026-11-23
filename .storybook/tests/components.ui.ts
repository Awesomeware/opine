import { expect, test } from '@playwright/test'

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`

test('contribution choices update their prompt without an application server', async ({ page }) => {
  await page.goto(story('feedback-contributiontype--default'))
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
  const context = page.getByRole('radio', { name: 'Context or example', exact: true })
  await context.focus()
  await page.keyboard.press('Space')
  await expect(context).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Different view', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Question', exact: true }).check()
  await expect(page.getByRole('radio', { name: 'Question', exact: true })).toBeChecked()
  await expect(page.getByText('What would you like clarified or answered?')).toBeVisible()
  await page.getByRole('radio', { name: 'Suggestion', exact: true }).check()
  await expect(page.getByRole('radio', { name: 'Question', exact: true })).not.toBeChecked()
  await expect(page.getByText('What would you suggest, and how would it help?')).toBeVisible()
})

test('disabled contribution choices cannot be changed', async ({ page }) => {
  await page.goto(story('feedback-contributiontype--disabled'))
  const choices = page.getByRole('radio')
  await expect(choices).toHaveCount(4)
  for (const choice of await choices.all()) await expect(choice).toBeDisabled()
})

test('contribution errors are associated with the group and choices', async ({ page }) => {
  await page.goto(story('feedback-contributiontype--error'))
  const group = page.getByRole('group', { name: 'Contribution type' })
  await expect(group).toHaveAccessibleDescription(
    /Choose how you want to contribute.*Choose a contribution type/,
  )
  for (const choice of await page.getByRole('radio').all()) {
    await expect(choice).toHaveAttribute('aria-invalid', 'true')
    await expect(choice).toHaveAccessibleDescription(
      /Choose how you want to contribute.*Choose a contribution type/,
    )
  }
})

test('feedback text preserves line breaks and protects contributed links', async ({ page }) => {
  await page.goto(story('feedback-text--default'))
  const text = page.locator('.feedback-text')
  await expect(text).toHaveCSS('white-space', 'pre-wrap')
  expect(await text.textContent()).toBe(
    'Please make the quest tracker easier to read.\nExample: https://example.com/feedback\n<script>alert("example")</script> and javascript:alert(1) are plain text.',
  )
  await expect(text).toContainText('<script>alert("example")</script>')
  await expect(text).toContainText('javascript:alert(1)')
  await expect(text.locator('script')).toHaveCount(0)
  const link = text.getByRole('link')
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('href', 'https://example.com/feedback')
  await expect(link).toHaveAttribute('rel', 'nofollow ugc noopener noreferrer')
})

test('buttons keep native keyboard activation and do not submit by default', async ({ page }) => {
  await page.goto(story('ui-button--default'))
  const button = page.getByRole('button', { name: 'Save changes' })
  await expect(button).toHaveAttribute('type', 'button')
  await button.evaluate((element) => {
    element.addEventListener('click', () => element.setAttribute('data-activated', 'true'))
  })
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('data-activated', 'true')
})

test('disabled and busy buttons communicate distinct states', async ({ page }) => {
  await page.goto(story('ui-button--disabled'))
  const button = page.getByRole('button', { name: 'Save changes' })
  await expect(button).toBeDisabled()
  await expect(button).not.toHaveAttribute('aria-busy', 'true')
  await page.goto(story('ui-button--busy'))
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('aria-busy', 'true')
})

test('long feedback links wrap at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(story('feedback-text--long-content'))
  await expect(page.locator('.feedback-text')).toBeVisible()
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasOverflow).toBe(false)
})

test('badges and notices render with shared theme styles and native semantics', async ({
  page,
}) => {
  await page.goto(story('ui-badge--default'))
  const badge = page.getByText('Under review', { exact: true })
  await expect(badge).toBeVisible()
  const badgeColor = await badge.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--color-badge-text)'
    element.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })
  await expect(badge).toHaveCSS('color', badgeColor)
  await page.goto(story('ui-notice--default'))
  const notice = page.getByRole('alert')
  await expect(notice).toHaveText('Please check the highlighted fields.')
  const noticeBackground = await notice.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--color-notice-background)'
    element.append(probe)
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  })
  await expect(notice).toHaveCSS('background-color', noticeBackground)
})

test('the brand keeps its accessible name while the tree mark remains decorative', async ({
  page,
}) => {
  await page.goto(story('ui-brand--default'))
  const brand = page.getByRole('img', { name: 'Opine', exact: true })
  await expect(brand).toBeVisible()
  await expect(brand).toHaveAttribute('aria-label', 'Opine')
  await expect(brand.locator('svg')).toHaveAttribute('aria-hidden', 'true')
})

test('feedback rows preserve the public link, status, and long text on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(story('feedback-postrow--long-content'))
  const row = page.getByRole('article')
  await expect(row.getByRole('heading', { level: 2 })).toBeVisible()
  await expect(row.getByRole('link')).toHaveAttribute('href', '/feedback/example-grouping')
  await expect(row).toContainText('Planned')
  await expect(row).toContainText('Grouping & travel')
  await expect(row.locator('time')).toHaveAttribute('datetime', '2026-11-20T12:00:00.000Z')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('official responses preserve status explanations and stable links without inventing a status change', async ({
  page,
}) => {
  const responseId = '00000000-0000-4000-8000-000000000002'
  const permalink = `/feedback/00000000-0000-4000-8000-000000000001?response=${responseId}#response-${responseId}`
  await page.goto(story('feedback-officialresponse--default'))
  const response = page.getByRole('article')
  await expect(
    response.getByRole('heading', { name: 'Official response', exact: true }),
  ).toBeVisible()
  await expect(response).toContainText('New → Reviewing')
  await expect(response).not.toHaveAttribute('id')
  await expect(response.getByRole('link', { name: 'Response link', exact: true })).toHaveAttribute(
    'href',
    permalink,
  )
  await page.goto(story('feedback-officialresponse--status-unchanged'))
  await expect(response).toContainText('Thank you for the examples.')
  await expect(response.locator('.status-change')).toHaveCount(0)
  await expect(response).not.toContainText('Reviewing')
  await expect(response.getByRole('link', { name: 'Response link', exact: true })).toHaveAttribute(
    'href',
    permalink,
  )
  await page.goto(story('feedback-officialresponse--linked'))
  await expect(response).toHaveAttribute('id', `response-${responseId}`)
  await expect(response).toContainText(
    'Linked official response · outside the selected filter or current page',
  )
  await expect(response.getByRole('link', { name: 'Response link', exact: true })).toHaveAttribute(
    'href',
    permalink,
  )
})

test('optional tags allow zero or multiple independent selections with native keyboard controls', async ({
  page,
}) => {
  await page.goto(story('feedback-tagpicker--default'))
  const picker = page.getByRole('group', { name: 'Tags (optional)', exact: true })
  await expect(picker.getByRole('checkbox', { checked: true })).toHaveCount(0)
  await expect(picker.getByRole('checkbox')).toHaveCount(2)
  const gameplay = picker.getByRole('checkbox', { name: 'Gameplay', exact: true })
  await gameplay.focus()
  await page.keyboard.press('Space')
  await expect(gameplay).toBeChecked()
  await picker.getByRole('checkbox', { name: 'UI', exact: true }).check()
  await expect(picker.getByRole('checkbox', { checked: true })).toHaveCount(2)
  await gameplay.uncheck()
  await expect(picker.getByRole('checkbox', { name: 'UI', exact: true })).toBeChecked()
  await page.goto(story('feedback-tagpicker--inactive'))
  const inactive = picker.getByRole('checkbox', { name: 'Older tag (inactive)', exact: true })
  await expect(inactive).toBeChecked()
  await expect(inactive).toBeEnabled()
  await inactive.uncheck()
  await expect(inactive).not.toBeChecked()
})

test('public tags render as descriptive labels rather than interactive filters', async ({
  page,
}) => {
  await page.goto(story('feedback-tags--default'))
  const tags = page.getByRole('list', { name: 'Tags', exact: true })
  await expect(tags.getByRole('listitem')).toHaveText(['🕹️Gameplay', 'UI'])
  await expect(tags.locator('[aria-hidden="true"]')).toHaveText('🕹️')
  await expect(tags).toMatchAriaSnapshot(`
    - list "Tags":
      - listitem: Gameplay
      - listitem: UI
  `)
  await expect(tags.getByRole('button')).toHaveCount(0)
  await expect(tags.getByRole('link')).toHaveCount(0)
})

test('shared form defaults keep native checkboxes compact and keyboard usable', async ({
  page,
}) => {
  await page.goto(story('ui-button--default'))
  await page.evaluate(() => {
    const label = document.createElement('label')
    label.innerHTML = '<input type="checkbox"> Needs follow-up'
    document.body.append(label)
  })
  const checkbox = page.getByRole('checkbox', { name: 'Needs follow-up', exact: true })
  const bounds = await checkbox.boundingBox()
  expect(bounds!.width).toBeLessThanOrEqual(24)
  expect(bounds!.height).toBeLessThanOrEqual(24)
  await checkbox.focus()
  await page.keyboard.press('Space')
  await expect(checkbox).toBeChecked()
})

test('shared typography loads real font faces and applies them to native elements', async ({
  page,
}) => {
  await page.goto(story('ui-button--default'))
  const button = page.getByRole('button', { name: 'Save changes' })
  await expect(button).toBeVisible()

  const loaded = await page.evaluate(async () => {
    const results = []
    for (const family of ['Source Sans 3', 'Source Serif 4']) {
      for (const weight of [400, 600, 700]) {
        const font = `${weight} 16px "${family}"`
        const faces = await document.fonts.load(font, 'Feedback')
        results.push({
          font,
          count: faces.length,
          loaded: faces.every((face) => face.status === 'loaded'),
          available: document.fonts.check(font, 'Feedback'),
        })
      }
    }

    const defaults = document.createElement('section')
    defaults.id = 'typography-defaults'
    defaults.innerHTML =
      '<h1>Feedback</h1><h2>Discussion</h2><input><textarea></textarea><select><option>All</option></select>'
    document.body.append(defaults)
    return results
  })

  // check() alone also succeeds for missing families that fall back to a system font.
  for (const face of loaded) {
    expect(face.count, face.font).toBeGreaterThan(0)
    expect(face.loaded, face.font).toBe(true)
    expect(face.available, face.font).toBe(true)
  }
  for (const element of [
    page.locator('body'),
    button,
    ...(await page
      .locator(
        '#typography-defaults input, #typography-defaults textarea, #typography-defaults select',
      )
      .all()),
  ]) {
    await expect(element).toHaveCSS('font-family', /^"?Source Sans 3"?(?:,|$)/)
  }
  for (const heading of await page.locator('#typography-defaults :is(h1, h2)').all()) {
    await expect(heading).toHaveCSS('font-family', /^"?Source Serif 4"?(?:,|$)/)
  }
})

test('semantic theme colors retain readable text and distinguish controls and focus', async ({
  page,
}) => {
  await page.goto(story('ui-button--primary'))
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()

  const contrasts = await page.evaluate(() => {
    const probe = document.createElement('span')
    document.body.append(probe)

    function luminance(token: string) {
      probe.style.color = `var(--color-${token})`
      const channels = getComputedStyle(probe)
        .color.match(/[\d.]+/g)!
        .map(Number)
      const linear = channels.slice(0, 3).map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722
    }

    const pairs: [string, string, number][] = [
      ['on-action', 'action-start', 4.5],
      ['on-action', 'action-hover', 4.5],
      ['official', 'official-background', 4.5],
      ['badge-text', 'badge-background', 4.5],
      ['review-text', 'review-background', 4.5],
      ['planned-text', 'planned-background', 4.5],
    ]
    for (const background of ['background', 'surface', 'control', 'control-hover']) {
      pairs.push(
        ['text-muted', background, 4.5],
        ['text', background, 4.5],
        ['focus', background, 3],
        ['control-border', background, 3],
        ['accent', background, 3],
      )
    }

    const results = pairs.map(([foreground, background, minimum]) => {
      const first = luminance(foreground)
      const second = luminance(background)
      return {
        pair: `${foreground} on ${background}`,
        ratio: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
        minimum,
      }
    })
    probe.remove()
    return results
  })

  for (const { pair, ratio, minimum } of contrasts) {
    expect(ratio, `${pair}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum)
  }
})

test('post rows place optional tag icons and names between the title and excerpt', async ({
  page,
}) => {
  await page.goto(story('feedback-postrow--default'))
  const row = page.getByRole('article')
  const tags = row.getByRole('list', { name: 'Tags', exact: true })
  await expect(tags.locator('[aria-hidden="true"]')).toHaveText('🕹️')
  await expect(tags.getByRole('listitem')).toContainText('Gameplay')
  await expect(row.locator('h2 + ul[aria-label="Tags"] + .row-excerpt')).toHaveText(
    'Forty minutes organising a group, barely an hour left to play.',
  )
})
