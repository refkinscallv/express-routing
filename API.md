# API Reference — @refkinscallv/express-routing v3.2.0

## Overview

Laravel-style routing system for Express.js supporting CommonJS, ESM, and TypeScript.
The v3 line introduces **handle()-based middleware**, **auto apply**, **chaining**, **controller auto-routing**, **errorHandler**, and **maintenance mode**.
v3.1.0 adds **consistent imports** — the `Routes` class resolves directly (no `.default`) across all three module systems.
v3.2.0 adds Laravel-style **named routes & URL generation**, **resource routes**, **named middleware aliases/groups**, **parameter constraints**, and **redirect/view/fallback** routes.

---

## Importing

The `Routes` class is the default export and is imported identically everywhere:

```js
// CommonJS
const Routes = require('@refkinscallv/express-routing')

// ESM
import Routes from '@refkinscallv/express-routing'

// TypeScript (types come along automatically)
import Routes, { HttpContext, RouteInfo, MiddlewareClass } from '@refkinscallv/express-routing'
```

> `require('@refkinscallv/express-routing').default` remains available at runtime for backward
> compatibility with `3.0.x`, but is no longer required for IDE autocomplete.

---

## HttpContext

All route handlers and `handle()` middleware receive a single `HttpContext` object:

```ts
interface HttpContext {
    req: Request;
    res: Response;
    next: NextFunction;
    error: Error | null;  // populated in errorHandler, null otherwise
}
```

---

## Routes.apply(appOrRouter, router?)

Apply all registered routes to Express.

| Signature | Description |
|-----------|-------------|
| `Routes.apply(app)` | Mount routes directly on the Express app |
| `Routes.apply(app, router)` | Mount routes on `router`, then auto `app.use(router)` |

```js
// Before (v2):
Routes.apply(router)
app.use(router)

// After (v3):
Routes.apply(app, router)    // router mounted automatically
// or
Routes.apply(app)            // direct mount
```

---

## HTTP Route Methods

```js
Routes.get(path, handler, middlewares?)
Routes.post(path, handler, middlewares?)
Routes.put(path, handler, middlewares?)
Routes.delete(path, handler, middlewares?)
Routes.patch(path, handler, middlewares?)
Routes.options(path, handler, middlewares?)
Routes.head(path, handler, middlewares?)
Routes.add(methods, path, handler, middlewares?)  // multiple methods
```

### Handler Types

```js
// 1. Inline function — receives HttpContext
Routes.get('/hello', ({ req, res, next, error }) => {
    res.json({ message: 'Hello' })
})

// 2. Static class method reference
class UserController {
    static index({ res }) { res.json({ users: [] }) }
}
Routes.get('/users', [UserController, 'index'])

// 3. Instance class method reference — auto-instantiated (`new UserController()`)
class ProfileController {
    show({ res }) { res.json({ profile: {} }) }
}
Routes.get('/profile', [ProfileController, 'show'])

// 4. Plain object method reference
const userObject = { list({ res }) { res.json([]) } }
Routes.get('/list', [userObject, 'list'])
```

### Multiple Methods — `Routes.add()`

```js
// Register the same handler for several HTTP methods at once
Routes.add(['get', 'post'], '/search', ({ req, res }) => {
    res.json({ method: req.method })
})
```

> **Order matters:** register all routes (and `errorHandler` / `maintenance`) **before** calling
> `Routes.apply()`. `apply()` is a one-time flush of everything registered so far.

---

## Middleware

Middleware can be:

| Type | Description |
|------|-------------|
| Plain function `(req, res, next) => void` | Classic Express middleware — passed through as-is |
| Object with `handle({ req, res, next, error })` | New style — auto-invoked |
| Class with static `handle({ req, res, next, error })` | New style — auto-invoked |
| Instance class with `handle({ req, res, next, error })` | New style — auto-invoked |

### Route-level Middleware

```js
Routes.get('/path', handler, [Middleware1, Middleware2])
```

### Scoped Global Middleware

```js
Routes.middleware([Middleware1, Middleware2], () => {
    Routes.get('/protected', handler)
    Routes.post('/data', handler)
})
```

### Chainable Middleware

When used without a callback, `Routes.middleware()` returns a chaining object.
**Note:** In chaining mode, middleware is STRICT and **must** implement a `handle()` method. Plain Express functions are not allowed.

```js
// Group chaining
Routes.middleware([Middleware1, Middleware2])
    .group('/prefix', () => {
        Routes.get('/route', handler)
    })

// Route chaining (supported for all HTTP methods)
Routes.middleware([AuthMiddleware]).get('/profile', handler)
Routes.middleware([AuthMiddleware]).post('/settings', handler)
```

> **Scope:** the chained middleware applies **only** to the single terminal call
> (`.get`, `.post`, `.group`, …) — it never leaks into later routes. A chain with no
> terminal call (e.g. a stray `Routes.middleware([Mw])`) is a no-op and registers nothing.

### Middleware Class Example

```js
// New style — class with static handle()
class AuthMiddleware {
    static handle({ req, res, next }) {
        if (!req.headers.authorization) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
        next()
    }
}

Routes.middleware([AuthMiddleware], () => {
    Routes.get('/secured', handler)
})

// Old style — plain function still works in scoped/route-level
const logMw = (req, res, next) => { console.log(req.path); next() }
Routes.middleware([logMw], () => {
    Routes.get('/logged', handler)
})
```

---

## Routes.group(prefix, callback, middlewares?)

Group routes under a common URL prefix with optional middleware.

```js
Routes.group('/api', () => {
    Routes.get('/users', handler)       // → GET /api/users
    Routes.post('/users', handler)      // → POST /api/users

    Routes.group('/v1', () => {
        Routes.get('/status', handler)  // → GET /api/v1/status
    }, [LogMiddleware])
})
```

Groups nest freely, and the active prefix / group middleware are always restored after the
callback returns — **even if the callback throws** — so a definition-time error can never
corrupt routes registered later.

---

## Routes.controller(basePath, Controller, methodMiddlewares?)

Auto-register all methods of a controller as routes.

### Rules

| Method name | HTTP method | Path |
|-------------|-------------|------|
| `index` | GET | `/<basePath>` |
| `camelCase` → `camel-case` | GET | `/<basePath>/camel-case` |
| `PascalCase` → `pascal-case` | GET | `/<basePath>/pascal-case` |
| `snake_case` → `snake-case` | GET | `/<basePath>/snake-case` |
| `Singleword` → `singleword` | GET | `/<basePath>/singleword` |
| `post_create` | POST | `/<basePath>/create` |
| `put_update` | PUT | `/<basePath>/update` |
| `delete_remove` | DELETE | `/<basePath>/remove` |
| `_anything` | — | **ignored** (private/helper method) |

### Private Methods

Any method whose name starts with an underscore (`_`) is treated as **internal** and is
**never** registered as a route — use it for shared helpers, validation, or formatting that
the controller's public methods call.

```js
class UserController {
    static index({ res }) { res.json(this._serialize([])) }  // GET /users
    static post_create({ req, res }) {                       // POST /users/create
        if (!this._isValid(req.body)) return res.status(422).end()
        res.status(201).json(req.body)
    }

    // Helpers below are NOT routed:
    static _serialize(users) { return { users } }
    static _isValid(body) { return Boolean(body && body.name) }
}

Routes.controller('users', UserController)
// Registered: GET /users, POST /users/create  (no /users/serialize, /users/is-valid)
```

### Controller Formats

A controller can be a **static class**, an **instance class**, or a **plain object**.

```js
// 1. Static class
class UserController {
    static index({ req, res }) { res.json({ users: [] }) }          // GET  /users
    static myProfile({ req, res }) { res.json({ profile: {} }) }    // GET  /users/my-profile
    static post_create({ req, res }) { res.status(201).json({ created: true }) } // POST /users/create
}
Routes.controller('users', UserController)

// 2. Instance class — auto-instantiated ONCE; `this` is shared across all its routes
class CartController {
    constructor() { this.items = [] }
    index({ res }) { res.json(this.items) }                         // GET  /cart
    post_add({ req, res }) { this.items.push(req.body); res.json(this.items) } // POST /cart/add
}
Routes.controller('cart', CartController)

// 3. Plain object
const ProductController = {
    index({ res }) { res.json({ products: [] }) },                  // GET  /products
    featuredItems({ res }) { res.json({ featured: [] }) },          // GET  /products/featured-items
}
Routes.controller('products', ProductController)
```

### Per-method Middleware

```js
const middlewares = {
    'myProfile': AuthMiddleware,
    'post_create': [AuthMiddleware, AdminMiddleware],
}

Routes.controller('users', UserController, middlewares)
```

> **Single instance:** an instance-class controller is constructed exactly once, and every
> resolved method is bound to that same instance — so shared `this` state works as expected and
> the constructor never runs more than once.

---

## Routes.resource(name, Controller, options?)

Register the seven RESTful resource routes for a controller (Laravel-style). Only the
actions the controller implements are registered.

| Action | Method | Path | Route name |
|--------|--------|------|------------|
| `index` | GET | `/<name>` | `<name>.index` |
| `create` | GET | `/<name>/create` | `<name>.create` |
| `store` | POST | `/<name>` | `<name>.store` |
| `show` | GET | `/<name>/:id` | `<name>.show` |
| `edit` | GET | `/<name>/:id/edit` | `<name>.edit` |
| `update` | PUT, PATCH | `/<name>/:id` | `<name>.update` |
| `destroy` | DELETE | `/<name>/:id` | `<name>.destroy` |

```js
Routes.resource('photos', PhotoController)
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `only` | `ResourceAction[]` | Register only these actions |
| `except` | `ResourceAction[]` | Register all actions except these |
| `parameter` | `string` | Path parameter name (default `'id'`) → `/photos/:photo` |
| `api` | `boolean` | Omit the HTML-form `create` and `edit` routes |
| `middleware` | `Middleware \| Middleware[]` | Middleware applied to every resource route |

```js
Routes.resource('books', BookController, { only: ['index', 'show'], parameter: 'book' })
Routes.resource('tags', TagController, { except: ['destroy'] })
Routes.resource('users', UserController, { middleware: ['auth'] })
```

## Routes.apiResource(name, Controller, options?)

Same as `resource()` but without the form-oriented `create` and `edit` routes — ideal for JSON APIs.

```js
Routes.apiResource('posts', PostController)
// → index, store, show, update, destroy  (no create/edit)
```

---

## Named Routes — `.name()`, `Routes.url()`, `Routes.route()`

Every route-definition method (`get`, `post`, `redirect`, …) returns a chainable
registration handle. Assign a name, then generate URLs.

```js
Routes.get('/users/:id', handler).name('users.show')

Routes.url('users.show', { id: 5 })             // → '/users/5'
Routes.route('users.show', { id: 5, tab: 'x' }) // → '/users/5?tab=x'   (route() is an alias)
```

- `:param` segments are substituted from `params`.
- Extra keys become a URL-encoded query string.
- A missing **required** param throws; an unknown route name throws.

---

## Parameter Constraints — `.where()`

```js
Routes.get('/users/:id', handler).whereNumber('id')   // matches only digits
Routes.get('/users/:name', handler)                   // '/users/john' falls through to here

Routes.get('/code/:c', handler).where('c', '[A-Z]{3}')
Routes.get('/u/:id', handler).where({ id: '[0-9]+' }) // multiple at once
```

| Helper | Pattern |
|--------|---------|
| `.whereNumber(p)` | `[0-9]+` |
| `.whereAlpha(p)` | `[A-Za-z]+` |
| `.whereAlphaNumeric(p)` | `[A-Za-z0-9]+` |
| `.whereUuid(p)` | `[0-9a-fA-F-]{36}` |
| `.where(p, pattern)` | custom string or `RegExp` |

A request whose parameter doesn't match is skipped with `next('route')`, allowing a later
route to match (or fall through to a 404 / `fallback`).

---

## Named Middleware — `Routes.registerMiddleware()` / `Routes.middlewareGroup()`

Register middleware once under a name, then reference it by string anywhere a middleware is accepted.

```js
// Single aliases
Routes.registerMiddleware('auth', AuthMiddleware)
Routes.registerMiddleware({ guest: GuestMiddleware, admin: AdminMiddleware })

// Group — expands to several (members may be aliases or classes)
Routes.middlewareGroup('web', ['auth', LogMiddleware])

// Use the string names
Routes.middleware(['auth']).get('/me', handler)
Routes.middleware(['web'], () => { Routes.get('/dashboard', handler) })
Routes.group('/admin', () => { /* ... */ }, ['admin'])
Routes.get('/x', handler, ['auth'])             // route-level
```

An unregistered name throws at definition time.

---

## Routes.redirect(from, to, status?)

```js
Routes.redirect('/old', '/new')        // 302 (default)
Routes.redirect('/legacy', '/home', 301)
```

## Routes.view(path, view, data?)

Render a template via the Express view engine (`res.render`). Requires a configured view engine.

```js
app.set('view engine', 'ejs')
Routes.view('/about', 'about', { title: 'About Us' })
```

## Routes.fallback(handler)

Register a handler invoked when **no** route matches (after all routes). Handler receives `HttpContext`.

```js
Routes.fallback(({ res }) => res.status(404).json({ error: 'Not Found' }))
Routes.fallback([NotFoundController, 'handle'])
```

---

## Routes.errorHandler(handler)

Register a global error handler for all routes. Handler receives the full `HttpContext` including `error`.

```js
// Function
Routes.errorHandler(({ req, res, next, error }) => {
    res.status(error?.status || 500).json({ message: error?.message })
})

// Controller binding
Routes.errorHandler([ErrorController, 'handle'])
```

> **Note:** The handler is registered as an Express 4-argument error middleware `(err, req, res, next)` at the end of the route chain. Call `Routes.apply()` after registering the handler.

---

## Routes.maintenance(enabled, handler?)

Enable or disable maintenance mode. When enabled, all requests receive a 503 response before any route is evaluated.

```js
// Default 503 response
Routes.maintenance(true)

// Custom response
Routes.maintenance(true, ({ req, res }) => {
    res.status(503).json({ message: 'Back soon!', maintenance: true })
})

// Controller binding
Routes.maintenance(true, [MaintenanceController, 'handle'])

// Disable
Routes.maintenance(false)
```

---

## Routes.allRoutes()

Returns an array of `RouteInfo` objects describing every registered route — useful for
debugging or printing a route table on boot.

```js
const routes = Routes.allRoutes()
// [{ methods, path, middlewareCount, handlerType }, ...]
```

| Field | Type | Description |
|-------|------|-------------|
| `methods` | `HttpMethod[]` | HTTP methods for the route |
| `path` | `string` | Normalized full path |
| `name` | `string \| null` | Route name (from `.name()`), or `null` |
| `middlewareCount` | `number` | Number of middlewares attached |
| `handlerType` | `'function' \| 'controller'` | `'function'` for inline handlers; `'controller'` for `Routes.controller()` / `resource()` routes and `[Controller, 'method']` tuples |

```js
Routes.allRoutes().forEach(r => {
    console.log(`${r.methods.join(',').toUpperCase()} ${r.path}`)
})
```

---

## Routes.normalizePath(path)

Normalize a path string — removes duplicate slashes and ensures a leading `/`.

```js
Routes.normalizePath('//api//users//') // → '/api/users'
```

---

## Routes.nameToPath(name)

Convert a method or function name to a URL-friendly kebab-case segment.

```js
Routes.nameToPath('samplePath')  // → 'sample-path'
Routes.nameToPath('SamplePath')  // → 'sample-path'
Routes.nameToPath('sample_path') // → 'sample-path'
Routes.nameToPath('Samplepath')  // → 'samplepath'
```

---

## Complete Examples

End-to-end applications wiring together groups, middleware, controllers, an error handler,
and `apply()`. The only difference between the three is the **import line** and how the
top-level `await` is expressed.

### CommonJS

```js
const express = require('express')
const Routes = require('@refkinscallv/express-routing')

const app = express()
const router = express.Router()
app.use(express.json())

class AuthMiddleware {
    static handle({ req, res, next }) {
        if (!req.headers.authorization) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
        next()
    }
}

class UserController {
    static index({ res }) { res.json({ users: ['Alice', 'Bob'] }) }     // GET  /users
    static post_create({ req, res }) { res.status(201).json(req.body) } // POST /users/create
}

Routes.get('/', ({ res }) => res.json({ message: 'Hello World' }))

Routes.middleware([AuthMiddleware]).get('/me', ({ res }) => res.json({ me: true }))

Routes.group('/api', () => {
    Routes.controller('users', UserController)
})

Routes.errorHandler(({ res, error }) => {
    res.status(error?.status || 500).json({ error: error?.message })
})

Routes.apply(app, router).then(() => {
    app.listen(3000, () => console.log('http://localhost:3000'))
})
```

### ESM

```js
import express from 'express'
import Routes from '@refkinscallv/express-routing'

const app = express()
const router = express.Router()
app.use(express.json())

class AuthMiddleware {
    static handle({ req, res, next }) {
        if (!req.headers.authorization) {
            return res.status(401).json({ error: 'Unauthorized' })
        }
        next()
    }
}

Routes.get('/', ({ res }) => res.json({ message: 'Hello World' }))
Routes.middleware([AuthMiddleware]).get('/me', ({ res }) => res.json({ me: true }))

await Routes.apply(app, router)
app.listen(3000, () => console.log('http://localhost:3000'))
```

### TypeScript

```ts
import express, { Application, Router } from 'express'
import Routes, { HttpContext, MiddlewareClass } from '@refkinscallv/express-routing'

const app: Application = express()
const router: Router = Router()
app.use(express.json())

class AuthMiddleware implements MiddlewareClass {
    handle({ req, res, next }: HttpContext): void {
        if (!req.headers.authorization) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }
        next()
    }
}

Routes.get('/', ({ res }: HttpContext) => res.json({ message: 'Hello World' }))
Routes.middleware([AuthMiddleware]).get('/me', ({ res }: HttpContext) => res.json({ me: true }))

await Routes.apply(app, router)
app.listen(3000, () => console.log('http://localhost:3000'))
```

> Runnable versions of these live in the [`example/`](example/) directory:
> `npm run example` (CommonJS), `npm run example:esm` (ESM), `npm run example:ts` (TypeScript).
