import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasRole, isPrivilegedRole, type Role } from '../shared/roles.ts'

test('membership and privileged roles have independent permissions', () => {
  const cases: { roles: Role[]; member: boolean; manager: boolean; administrator: boolean }[] = [
    { roles: [], member: false, manager: false, administrator: false },
    { roles: ['member'], member: true, manager: false, administrator: false },
    { roles: ['member', 'community-manager'], member: true, manager: true, administrator: false },
    { roles: ['member', 'administrator'], member: true, manager: false, administrator: true },
    {
      roles: ['member', 'community-manager', 'administrator'],
      member: true,
      manager: true,
      administrator: true,
    },
  ]

  for (const { roles, member, manager, administrator } of cases) {
    assert.equal(hasRole(roles, 'member'), member)
    assert.equal(hasRole(roles, 'community-manager'), manager)
    assert.equal(hasRole(roles, 'administrator'), administrator)
  }
})

test('only explicit privileged roles can be assigned', () => {
  assert.equal(isPrivilegedRole('community-manager'), true)
  assert.equal(isPrivilegedRole('administrator'), true)
  for (const role of [
    'member',
    'admin',
    '',
    'Administrator',
    ' administrator ',
    null,
    undefined,
    1,
  ]) {
    assert.equal(isPrivilegedRole(role), false)
  }
})
