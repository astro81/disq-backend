import { Hono } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { logger } from "hono/logger"
import { cors } from 'hono/cors'

import { websocket } from 'hono/bun'


import messages from '@/api/messages'

import attachments from '@/api/attachments'

import ws from '@/api/ws'

const app = new Hono()


app.use('*', cors({
  origin: [process.env.FRONTEND_URL ?? "https://cozy-treacle-17c90f.netlify.app/"],
  credentials: true,
}))


app.use(prettyJSON({ space: 4 })) 
app.use('*', logger());


app.get('/', (c) => c.text('Hello Hono!'))


app.route('/api/messages', messages)

app.route('/api/attachments', attachments)


app.route('/', ws)   // /ws/channel/:channelId


export default {
	port: Number(process.env.PORT) || 3000,
	fetch: app.fetch,
	websocket
}
