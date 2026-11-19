import { fromNodeHeaders } from 'better-auth/node'
import { getAccess } from '../../access.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return (await getAccess(fromNodeHeaders(event.node.req.headers))) ?? { user: null, roles: [] }
})
