# @refkinscallv/express-routing

[![npm version](https://img.shields.io/npm/v/@refkinscallv/express-routing)](https://www.npmjs.com/package/@refkinscallv/express-routing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Laravel-style routing system for Express.js — with full support for **CommonJS**, **ESM**, and **TypeScript**.

---

## Features

- ✅ Laravel-style route grouping and prefixing
- ✅ `handle()`-based middleware — no need to reference specific methods
- ✅ Strict Chaining: `Routes.middleware([Mw]).get(...)` or `.group(...)`
- ✅ `Routes.apply(app, router)` — auto mounts router
- ✅ `Routes.controller()` — auto-register all methods with optional per-method middlewares
- ✅ `Routes.errorHandler()` — global typed error handler
- ✅ `Routes.maintenance()` — toggle maintenance mode
- ✅ `HttpContext` with `{ req, res, next, error }` in all handlers
- ✅ Static class, instance class, and plain object controllers
- ✅ CommonJS, ESM, and TypeScript support

---

## Installation

```bash
npm install @refkinscallv/express-routing
```

---

## Quick Start

### CommonJS

```js
const express = require('express')
const Routes = require('@refkinscallv/express-routing')

const app = express()
const router = express.Router()
app.use(express.json())

Routes.get('/', ({ res }) => res.json({ message: 'Hello World' }))

Routes.apply(app, router).then(() => {
    app.listen(3000)
})
```

---

## Middleware

### New style — class or object with `handle()`

**Highly Recommended.** When chaining (`Routes.middleware([...]).get(...)`), middleware **MUST** be an object or class that implements a `handle()` method.

```js
class AuthMiddleware {
    static handle({ req, res, next }) {
        if (!req.headers.authorization) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
        next()
    }
}

// Chaining (Strict mode: only handle() allowed)
Routes.middleware([AuthMiddleware]).group('/api', () => { ... })
Routes.middleware([AuthMiddleware]).get('/secured', handler)

// Scoped (with callback)
Routes.middleware([AuthMiddleware], () => {
    Routes.get('/secured', handler)
})
```

### Old style — plain Express function (still works)

Only works in **scoped** calls or **route-level** injection.

```js
const mw = (req, res, next) => { req.user = 'guest'; next() }
Routes.middleware([mw], () => {
    Routes.get('/route', handler)
})
```

---

## Route Groups

```js
Routes.group('/api', () => {
    Routes.get('/users', handler)       // GET /api/users
    Routes.post('/users', handler)      // POST /api/users

    Routes.group('/v1', () => {
        Routes.get('/status', handler)  // GET /api/v1/status
    })
})
```

---

## Controllers

### `Routes.controller()` — auto-routing

```js
class UserController {
    static index({ res }) { res.json({ users: [] }) }      // GET /users
    static myProfile({ res }) { res.json({}) }             // GET /users/my-profile
    static post_create({ req, res }) { res.json({}) }      // POST /users/create
}

// Controller with optional per-method middlewares
Routes.controller('users', UserController, {
    'myProfile': AuthMiddleware,
    'post_create': [AuthMiddleware, AdminMiddleware]
})
```

### `[Controller, 'method']` — explicit binding

```js
class UserController {
    static index({ req, res }) { res.json({ users: [] }) }
}

Routes.get('/users', [UserController, 'index'])
```

---

## API Reference

See [API.md](API.md) for complete documentation.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
