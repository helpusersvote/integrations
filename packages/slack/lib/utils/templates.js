const _ = require('lodash')
const fs = require('fs')
const { promisify } = require('util')
const { resolve } = require('path')

// Change the interpolation lookup regex for lodash
_.templateSettings.interpolate = /{{([\s\S]+?)}}/g

const readdir = promisify(fs.readdir).bind(fs)
const readFile = promisify(fs.readFile).bind(fs)

const templates = {}
const templatesDir = '../templates/'

async function prepareTemplates() {
  const files = await readdir(resolve(__dirname, templatesDir))

  return await Promise.all(
    files.map(async file => {
      const buf = await readFile(resolve(__dirname, templatesDir + file))

      templates[file.replace('.html', '')] = _.template(buf.toString())

      return { file, loaded: true }
    })
  )
}

async function renderTemplate(name, opts) {
  // if (!templates.success) {
  await prepareTemplates()
  // }

  return templates[name](opts)
}

module.exports = { prepareTemplates, renderTemplate }
