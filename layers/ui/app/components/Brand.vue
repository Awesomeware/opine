<template>
  <span class="ui-brand" role="img" aria-label="Opine">
    <svg viewBox="0 0 40 44" aria-hidden="true">
      <ellipse
        cx="20"
        cy="22"
        rx="16"
        ry="19"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      />
      <path d="m20 6-5 9h3l-6 9h4l-6 9h8v5h4v-5h8l-6-9h4l-6-9h3Z" fill="currentColor" />
    </svg>
    <span aria-hidden="true">pine</span>
  </span>
</template>
<style scoped>
.ui-brand {
  display: inline-flex;
  align-items: center;
  color: var(--color-text);
  font-family: var(--font-heading);
  font-size: 2.5rem;
  line-height: 1;
  letter-spacing: -0.05em;
}
svg {
  width: 35px;
  height: 40px;
  color: var(--color-accent);
  margin-right: 1px;
}
</style>
