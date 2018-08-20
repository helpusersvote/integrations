const bodyParser = require('body-parser')
const express = require('express')
const assert = require('assert')
const axios = require('axios')

const logger = require('./utils/logger')
const { prepareTemplates, renderTemplate } = require('./utils/templates')
const { wrap } = require('./utils/async')

const server = express()
const clientId = (process.env.SLACK_CLIENT_ID || '').trim()
const clientSecret = (process.env.SLACK_CLIENT_SECRET || '').trim()
const redirectUri = process.env.SLACK_REDIRECT_URI

const configApiHost = (
  process.env.CONFIG_API_HOST || 'http://huv-config-api'
).trim()
const configNamespace = process.env.CONFIG_NAMESPACE || 'huv-slack'
const homeURL = 'https://helpusersvote.com'

assert(clientId, '`SLACK_CLIENT_ID` environment variable missing')
assert(clientSecret, '`SLACK_CLIENT_SECRET` environment variable missing')

console.log(JSON.stringify(clientId))
console.log(JSON.stringify(clientSecret))

prepareTemplates()

server.use(logger.expressMiddleware())

server.get('/', (_, res) => res.redirect(homeURL))
server.get('/internal/health', (_, res) => res.json({ ok: true }))
server.get('/success', wrap(renderSuccess))

server.use(bodyParser.json())
server.get(
  '/:type/oauth/redirect',
  wrap(async (req, res) => {
    const { type } = req.params
    const { code } = req.query

    if (!code) {
      return res.json({
        error: true,
        message: 'Missing `?code` query param from Slack'
      })
    }

    try {
      const data = await getAccessFromCode(code)

      if (data.error) {
        throw new Error(data.error)
      }

      const {
        access_token,
        team_name,
        team_id,
        incoming_webhook: { channel_id, url: channel_url, configuration_url }
      } = data

      await storeAppData({
        access_token,
        configuration_url,
        channel_url,
        channel_id,
        team_name,
        team_id,
        type
      })

      return res.redirect(
        `/success?type=${type}&team=${team_id}&channel=${channel_id}`
      )
    } catch (err) {
      console.error(err)
      logger.error(err.message || err)

      return res.redirect('/error')
    }
  })
)

server.post(
  '/:type/welcome',
  wrap(async (req, res) => {
    const { type } = req.params
    const { team_id, channel_id } = req.body

    if (!team_id || !channel_id) {
      return res.json({
        error: true,
        message: 'Requires `team_id` and `channel_id` in request body'
      })
    }

    try {
      const data = await getAppData({ type, team_id, channel_id })
      const { has_been_welcomed, access_token, channel_url } = data
      const message = 'https://helpusersvote.com/countdowns/election?days=78'

      if (has_been_welcomed) {
        return res.json({
          error: true,
          message: 'Already sent welcome message!'
        })
      }

      storeAppData({
        type,
        ...data,
        team_id,
        channel_id,
        has_been_welcomed: true
      }).catch(err => {
        logger.error('slack.storeAppData.fail: could not send message', {
          team_id,
          channel_id
        })
        console.error(err.toString())
      })

      sendMessage({
        access_token,
        channel_url,
        message
      })
        .then(r => console.log(r.data))
        .catch(err => {
          logger.error('slack.sendMessage.fail: could not send message', {
            team_id,
            channel_id
          })
          console.error(err.toString())
        })

      return res.json({
        ok: true
      })
    } catch (err) {
      console.error(err)
      return res.json({
        error: true,
        message: err.message
      })
    }
  })
)

async function sendMessage({ access_token, channel_url, message }) {
  return await axios({
    method: 'post',
    url: channel_url,
    data: {
      attachments: [
        {
          fallback: 'https://helpusersvote.com/countdowns/election',
          color: '#1a3852',
          title: '77 Days left to Election Day',
          title_link: 'https://helpusersvote.com/countdowns/election',
          image_url: 'https://og-images.helpusersvote.com/?days=77',
          thumb_url: 'https://og-images.helpusersvote.com/?days=77',
          footer_icon:
            'https://platform.slack-edge.com/img/default_application_icon.png'
        }
      ]
    }
  })
}

async function getAppData({ type, team_id, channel_id }) {
  const namespaceId = `${configNamespace}-${type}`
  const configId = `${team_id}-${channel_id}`

  logger.info('slack.getAppData: fetching', { namespaceId, configId })

  return await axios({
    method: 'get',
    url: `${configApiHost}/v1/namespaces/${namespaceId}/configs/${configId}`
  })
    .then(r => r.data)
    .then(d => d.body)
}

async function storeAppData(payload) {
  const { type, team_id, channel_id, ...props } = payload
  const namespaceId = `${configNamespace}-${type}`
  const configId = `${team_id}-${channel_id}`

  logger.info('slack.storeAppData: persisting', { namespaceId, configId })

  return await axios({
    method: 'put',
    url: `${configApiHost}/v1/namespaces/${namespaceId}/configs/${configId}`,
    data: {
      type,
      body: {
        team_id,
        channel_id,
        ...props
      }
    }
  }).then(r => r.data)
}

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

const apps = {
  'election-countdown': {
    appName: 'Election Countdown'
  },
  registrationDeadline: {
    prefixAppTitle: '<br />',
    appName: 'Voter Registration Deadlines Countdown'
  }
}

async function renderSuccess(req, res) {
  const { appName, prefixAppTitle } = apps[req.query.id || 'election-countdown']
  const tpl = await renderTemplate('success', {
    appName,
    prefixAppTitle
  })

  return res.end(tpl)
}

module.exports = server
