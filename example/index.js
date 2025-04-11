/**
 * packages
 */
const express = require('express')
const http = require('http')
const Routes = require('../src/routes')

/**
 * initialize
 */
const url = 'http://localhost'
const port = 3000
const app = express()
const router = express.Router()
const server = http.createServer(app)

/**
 * middlewares
 */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/**
 * init routes
 */
require('./web')
Routes.apply(router)
app.use(router)

/**
 * run the server
 */
server.listen(3000, () => {
  console.log(`Server already running on ${url}:${port}`)
})
