const express = require('express')
const Routes = require('../src/routes')

// Import route definitions (registers routes)
require('./web')

const PORT = 3000
const app = express()
const router = express.Router()

// Apply all registered routes to the router
Routes.apply(router)

// Use the router in the Express app
app.use(router)

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`)
})