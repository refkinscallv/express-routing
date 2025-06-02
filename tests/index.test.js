const request = require('supertest')
const express = require('express')
const Routes = require('../src/routes')
require('../example/web')

describe('Express App (JS)', () => {
    let app

    beforeAll(() => {
        app = express()
        const router = express.Router()
        Routes.apply(router)
        app.use(router)
    })

    it('GET / should return 200', async () => {
        const res = await request(app).get('/directly')
        expect(res.statusCode).toBe(200)
        expect(res.text || res.body).toBeDefined()
    })
})
