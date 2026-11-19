import { closeDatabase } from '../db'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeDatabase)
})
