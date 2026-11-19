import { getAuth } from '../../auth.ts'

export default defineEventHandler((event) => {
  const request = toWebRequest(event)
  // Never trust a client-supplied forwarding header for rate-limit identity.
  request.headers.set('x-opine-client-ip', event.node.req.socket.remoteAddress ?? '127.0.0.1')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return getAuth().handler(request)
})
