const winston = require('winston')
const expressWinston = require('express-winston')

const transports = [
  new winston.transports.Console({
    json: true,
    colorize: true
  })
].filter(Boolean)

const logger = winston.createLogger({
  transports
})

logger.expressMiddleware = () =>
  expressWinston.logger({
    winstonInstance: logger
  })

module.exports = logger
