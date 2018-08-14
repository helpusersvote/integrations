const { wrap } = require('./utils/async')
const logger = require('./utils/logger')
const bodyParser = require('body-parser')
const express = require('express')
const assert = require('assert')
const axios = require('axios')

const server = express()
const clientId = process.env.SLACK_CLIENT_ID
const clientSecret = process.env.SLACK_CLIENT_SECRET
const redirectUri = process.env.SLACK_REDIRECT_URI

assert(clientId, '`SLACK_CLIENT_ID` environment variable missing')
assert(clientSecret, '`SLACK_CLIENT_SECRET` environment variable missing')

server.use(logger.expressMiddleware())

server.get('/', (_, res) =>
  res.redirect('https://helpusersvote.com/countdowns')
)

server.use(bodyParser.json())
server.get(
  '/:type/oauth/redirect',
  wrap(async (req, res) => {
    const { type } = req.params
    const { code } = req.query

    try {
      const data = await getAccessFromCode(code)

      // TODO: store access/refresh tokens
      //
      // Etcd/redis:
      //   - key=`slack::${type}::${data.team_id}`
      //     value=JSON.stringify({ channel_id, channel_url })
      //
      // Vault:
      //   - key=`slack-${type}-${data.team_id}`
      //     value=JSON.stringify({ access_token })

      return res.redirect('/done')
    } catch (err) {
      console.error(err)

      return res.redirect('/error')
    }
  })
)

async function getAccessFromCode(code) {
  return await axios({
    method: 'get',
    url: 'https://slack.com/api/oauth.access',
    params: {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    }
  }).then(r => r.data)
}

module.exports = server
