require('dotenv').config()

const server = require('./lib/server')
const logger = require('./lib/utils/logger')
const port = process.env.PORT || 3000

server.listen(port)
logger.info('server started', { port })
