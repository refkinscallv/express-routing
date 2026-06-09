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
- ✅ Private controller methods — `_`-prefixed methods are skipped, never routed
- ✅ **Named routes + URL generation** — `.name('users.show')` then `Routes.url('users.show', { id })`
- ✅ **Resource routes** — `Routes.resource()` / `Routes.apiResource()` (RESTful, auto-named)
- ✅ **Named middleware** — `Routes.registerMiddleware('auth', Mw)` + middleware groups
- ✅ **Parameter constraints** — `.whereNumber('id')`, `.where('id', '[0-9]+')`
- ✅ **`redirect()`, `view()`, `fallback()`** routes
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

The `Routes` class is imported the **same, consistent way** in every module system —
no `.default` access required. Pick the snippet that matches your project.

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

### ESM

```js
import express from 'express'
import Routes from '@refkinscallv/express-routing'

const app = express()
const router = express.Router()
app.use(express.json())

Routes.get('/', ({ res }) => res.json({ message: 'Hello World' }))

await Routes.apply(app, router)
app.listen(3000)
```

### TypeScript

```ts
import express, { Application, Router } from 'express'
import Routes, { HttpContext } from '@refkinscallv/express-routing'

const app: Application = express()
const router: Router = Router()
app.use(express.json())

Routes.get('/', ({ res }: HttpContext) => res.json({ message: 'Hello World' }))

await Routes.apply(app, router)
app.listen(3000)
```

> **Note on imports:** `require('@refkinscallv/express-routing')` returns the `Routes` class
> directly with full IDE autocomplete — no `.default` needed. The `.default` property is still
> exported at runtime for backward compatibility with `3.0.x`.

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
    static _helper() { /* ... */ }                         // ignored — not routed
}

// Controller with optional per-method middlewares
Routes.controller('users', UserController, {
    'myProfile': AuthMiddleware,
    'post_create': [AuthMiddleware, AdminMiddleware]
})
```

> **Private methods:** any method whose name starts with `_` (e.g. `_helper`) is treated as an
> internal helper and is **never** exposed as a route — handy for shared logic the public
> controller methods call.

### `[Controller, 'method']` — explicit binding

```js
class UserController {
    static index({ req, res }) { res.json({ users: [] }) }
}

Routes.get('/users', [UserController, 'index'])
```

---

## Resource Routes

Register the seven RESTful routes for a controller in one call — Laravel-style.

```js
class PhotoController {
    static index({ res })   { /* GET    /photos          */ }
    static create({ res })  { /* GET    /photos/create   */ }
    static store({ res })   { /* POST   /photos          */ }
    static show({ res })    { /* GET    /photos/:id      */ }
    static edit({ res })    { /* GET    /photos/:id/edit */ }
    static update({ res })  { /* PUT|PATCH /photos/:id   */ }
    static destroy({ res }) { /* DELETE /photos/:id      */ }
}

Routes.resource('photos', PhotoController)
Routes.apiResource('posts', PostController)                         // omits create & edit
Routes.resource('books', BookController, { only: ['index', 'show'] })
Routes.resource('tags', TagController, { except: ['destroy'], parameter: 'tag' })
```

Each route is auto-named `<name>.<action>` (e.g. `photos.show`). Only the actions your
controller actually implements are registered.

---

## Named Routes & URL Generation

```js
Routes.get('/users/:id', handler).name('users.show')

Routes.url('users.show', { id: 5 })            // → '/users/5'
Routes.route('users.show', { id: 5, ref: 'a' }) // → '/users/5?ref=a'  (alias of url())
```

Extra params become a query string; a missing required param throws.

---

## Named Middleware

```js
Routes.registerMiddleware('auth', AuthMiddleware)
Routes.registerMiddleware({ guest: GuestMiddleware, admin: AdminMiddleware })

// Group several middlewares under one name (members may be aliases or classes)
Routes.middlewareGroup('web', ['auth', LogMiddleware])

// Use by string — scoped or chained
Routes.middleware(['auth']).get('/me', handler)
Routes.middleware(['web'], () => {
    Routes.get('/dashboard', handler)
})
```

---

## Parameter Constraints

```js
Routes.get('/item/:id', handler).whereNumber('id')   // matches only digits
Routes.get('/item/:slug', handler)                   // '/item/abc' falls through to here

Routes.get('/code/:c', handler).where('c', '[A-Z]{3}')
// helpers: whereNumber, whereAlpha, whereAlphaNumeric, whereUuid
```

A request whose parameter does not match is skipped (`next('route')`), so a later route can match.

---

## Redirect, View & Fallback

```js
Routes.redirect('/old', '/new')        // 302
Routes.redirect('/legacy', '/home', 301)

Routes.view('/about', 'about', { title: 'About Us' })   // res.render via your view engine

Routes.fallback(({ res }) => res.status(404).json({ error: 'Not Found' }))
```

---

## API Reference

See [API.md](API.md) for complete documentation.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
