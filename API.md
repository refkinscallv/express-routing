# API Reference — @refkinscallv/express-routing v3.0.0

## Overview

Laravel-style routing system for Express.js supporting CommonJS, ESM, and TypeScript.
Version 3.0.0 introduces **handle()-based middleware**, **auto apply**, **chaining**, **controller auto-routing**, **errorHandler**, and **maintenance mode**.

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
Routes.get('/users', [UserController, 'index'])

// 3. Instance class method reference
Routes.get('/users', [UserController, 'index'])  // auto-instantiated

// 4. Plain object method reference
Routes.get('/users', [userObject, 'list'])
```

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

### Controller Formats

```js
// Static class
class UserController {
    static index({ req, res }) { res.json({ users: [] }) }
    static myProfile({ req, res }) { res.json({ profile: {} }) }
    static post_create({ req, res }) { res.status(201).json({ created: true }) }
}

// Per-method middleware mapping
const middlewares = {
    'myProfile': AuthMiddleware,
    'post_create': [AuthMiddleware, AdminMiddleware]
}

Routes.controller('users', UserController, middlewares)
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

Returns an array of route information objects.

```js
const routes = Routes.allRoutes()
// [{ methods, path, middlewareCount, handlerType }, ...]
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
