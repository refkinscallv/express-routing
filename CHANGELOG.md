# Changelog

All notable changes to `@refkinscallv/express-routing` will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.2.0] - 2026-06-10

A big step toward Laravel parity — all additive and backward compatible.

### ✨ New Features

#### Named routes + URL generation
Route-definition methods now return a chainable registration handle:

```js
Routes.get('/users/:id', handler).name('users.show')
Routes.url('users.show', { id: 5 })            // → '/users/5'
Routes.route('users.show', { id: 5, tab: 'a' }) // → '/users/5?tab=a'  (route() is an alias of url())
```

Unused params are appended as a query string; missing required params throw.
`allRoutes()` now includes each route's `name`.

#### Resource routes — `resource()` / `apiResource()`
```js
Routes.resource('photos', PhotoController)
// GET    /photos             → index    (photos.index)
// GET    /photos/create      → create   (photos.create)
// POST   /photos             → store    (photos.store)
// GET    /photos/:id         → show     (photos.show)
// GET    /photos/:id/edit    → edit     (photos.edit)
// PUT|PATCH /photos/:id      → update   (photos.update)
// DELETE /photos/:id         → destroy  (photos.destroy)

Routes.apiResource('posts', PostController)            // omits create & edit
Routes.resource('books', BookController, { only: ['index', 'show'], parameter: 'book' })
```
Only actions the controller actually implements are registered.

#### Named middleware aliases & groups
```js
Routes.registerMiddleware('auth', AuthMiddleware)
Routes.registerMiddleware({ guest: GuestMiddleware, admin: AdminMiddleware })
Routes.middlewareGroup('web', ['auth', LogMiddleware])

Routes.middleware(['auth']).get('/me', handler)        // use by string
Routes.middleware(['web'], () => { Routes.get('/dash', handler) })
```

#### Parameter constraints — `where()`
```js
Routes.get('/item/:id', handler).whereNumber('id')     // only digits
Routes.get('/item/:slug', handler)                     // non-numeric falls through to here
Routes.get('/code/:c', handler).where('c', '[A-Z]{3}')
// also: whereAlpha, whereAlphaNumeric, whereUuid
```
A non-matching parameter is skipped with `next('route')`, so a later route can still match.

#### Redirect, view & fallback routes
```js
Routes.redirect('/old', '/new')        // 302
Routes.redirect('/old', '/new', 301)   // permanent
Routes.view('/about', 'about', { title: 'About' })  // res.render via the view engine
Routes.fallback(({ res }) => res.status(404).json({ error: 'Not Found' }))
```

### 🔧 Improvements

- `RouteHandler` return type widened to allow the natural `({ res }) => res.json(...)` form
  (returning a response/value no longer fails strict TypeScript).
- `Middleware` type now also accepts a `string` (registered alias/group name).
- All version strings synchronized to `3.2.0`; types updated across `.d.ts` / `.d.mts` / `.d.cts`.

---

## [3.1.0] - 2026-06-10

### 🐛 Fixes

- **Consistent imports & IDE autocomplete across CommonJS, ESM, and TypeScript.**
  Previously, CommonJS users had to write `require('@refkinscallv/express-routing').default`
  to get type information and IDE autocomplete, and true-ESM consumers hit the same problem.
  The root cause was a single ambiguous `types/index.d.ts` resolved as CommonJS (because the
  package is `"type": "commonjs"`), which forced `.default` access for typing.

  Now each module system resolves the `Routes` class **directly**:

  ```js
  // CommonJS — no more `.default`
  const Routes = require('@refkinscallv/express-routing')

  // ESM
  import Routes from '@refkinscallv/express-routing'

  // TypeScript
  import Routes from '@refkinscallv/express-routing'
  ```

  > `require('@refkinscallv/express-routing').default` still works at runtime for backward compatibility.

- **`example/typescript.ts` build error under `@types/express@5`.**
  `req.params.id` now widens to `string | string[]`; the example casts to `string` before `parseInt`,
  so `npm run build` (and therefore `prepublishOnly`) passes again.

- **State corruption when a `group()` / scoped `middleware()` callback throws.**
  The `prefix` and `groupMiddlewares` / `globalMiddlewares` were left mutated, so every
  route defined *after* a definition-time error was silently registered under the wrong
  prefix or with stray middleware. Both are now restored via `try/finally`.

- **Chaining `Routes.middleware([Mw])` with no terminal call leaked middleware.**
  Calling `Routes.middleware([Mw])` without a following `.get()` / `.group()` permanently
  pushed the middleware into `globalMiddlewares`, so unrelated later routes wrongly received
  it. The chained middleware is now scoped to each terminal call only.

- **Instance controllers created a new instance per method.**
  `Routes.controller('x', MyClass)` ran the constructor once *per route method* and bound each
  method to a different instance, breaking shared `this` state and multiplying constructor
  side effects. A class controller is now instantiated **once** and shared across its routes.

- **`allRoutes()` mislabeled controller routes.**
  Controller-resolved routes now report `handlerType: 'controller'` (previously `'function'`).

- **Class middleware with an *instance* `handle()` crashed at runtime.**
  Passing a class whose `handle()` lives on the prototype (e.g. `class Mw { handle(ctx) {} }`) —
  a form the types and docs explicitly allow — fell through to the "plain Express function" path,
  so Express invoked the class without `new` and threw
  *"Class constructor … cannot be invoked without 'new'"*. Middleware resolution now handles
  **static `handle()`, instance `handle()` (instantiated once), and plain-object `handle()`**
  uniformly, in both scoped and chaining modes.

- **`example/typescript.ts` crashed on startup (`npm run example:ts`).**
  It imported the runtime `Routes` value from `../types/index`, a types-only `.d.ts` with no
  JavaScript. All examples now import from the package itself
  (`@refkinscallv/express-routing`), matching real-world usage, and all three
  (`example`, `example:esm`, `example:ts`) boot and serve requests correctly under Express 5.

### ✨ New Features

- **Private controller methods.** Any method whose name starts with `_` (e.g. `_helper`,
  `_method1`) is now treated as internal and is **never** registered as a route — across
  static-class, instance-class, and plain-object controllers. Use them for shared helpers,
  validation, or formatting that the public controller methods call.

  ```js
  class UserController {
      static index({ res }) { res.json(this._serialize([])) }  // GET /users
      static _serialize(users) { return { users } }            // ignored — not routed
  }
  ```

### 🔧 Improvements

- Added dedicated, condition-specific type declarations:
  - `types/index.d.mts` — ESM (`export default class Routes`) for the `import` condition.
  - `types/index.d.cts` — CommonJS (`export = Routes`) for the `require` condition.
  - `types/index.d.ts` — retained for the legacy top-level `types` field.
- `package.json` `exports` map now declares per-condition `types` (nested `import`/`require`).
- All version strings synchronized to `3.1.0`.

### 📦 Dependencies

- `express` → `^5.2.1`
- `@types/express` → `^5.0.6`, `@types/node` → `^25.9.2`, `@types/jest` → `^30.0.0`,
  `@types/supertest` → `^7.2.0`, `cross-env` → `^10.1.0`, `jest` → `^30.4.2`,
  `nodemon` → `^3.1.14`, `supertest` → `^7.2.2`, `ts-jest` → `^29.4.11`, `typescript` → `^6.0.3`.

---

## [3.0.0] - 2026-05-01

### 🚀 Breaking Changes

- **`Routes.apply(router)`** → **`Routes.apply(app, router?)`**
  - When called with two arguments (`app`, `router`), the router is automatically mounted on the app — no need to call `app.use(router)` separately.
  - Single-argument call (`Routes.apply(app)`) still works for direct mounting.

- **`Routes.middleware([Middleware.method])`** → **`Routes.middleware([Middleware])`**
  - Middleware entries now support an object or class with a `handle({ req, res, next, error })` method.
  - The `handle()` method is **automatically detected and invoked** — no need to reference a specific method manually.
  - Plain Express functions `(req, res, next)` still work unchanged *in scoped and route-level middlewares*.

- **Strict Middleware Chaining**
  - When chaining (`Routes.middleware([...]).get(...)`), you **MUST** provide middleware that implements a `handle()` method. Plain Express functions will throw an error if used in chaining syntax.

- **`HttpContext`** now includes `error: Error | null`
  - All handlers receive `{ req, res, next, error }`.
  - `error` is `null` for normal requests and populated inside `Routes.errorHandler()`.

### ✨ New Features

#### Middleware Chaining for All Methods
```js
// Routes.middleware() without a callback returns a chainable object for all HTTP methods:
Routes.middleware([Mw1, Mw2]).group('/prefix', () => { ... })
Routes.middleware([Mw1, Mw2]).get('/path', handler)
Routes.middleware([Mw1, Mw2]).post('/path', handler)
Routes.middleware([Mw1, Mw2]).delete('/path', handler)
```

#### `Routes.controller(basePath, Controller, methodMiddlewares?)`
- Auto-register all methods of a controller as routes.
- Supports **static class**, **instance class**, and **plain object** controllers.
- Added optional third parameter for **per-method middleware mapping**:
  ```js
  Routes.controller('users', UserController, {
      'myProfile': AuthMiddleware,
      'post_create': [AuthMiddleware, AdminMiddleware]
  })
  ```

#### `Routes.errorHandler(handler)`
- Register a global error handler that receives `{ req, res, next, error }`.
- Supports inline function or `[Controller, 'method']` binding.

#### `Routes.maintenance(enabled, handler?)`
- Toggle maintenance mode on/off.
- Default response is HTTP 503 with JSON body.
- Supports custom inline handler or `[Controller, 'method']` binding.
- When enabled, **all requests** are intercepted before any route runs.

### 🔧 Improvements

- `Routes.resolveHandler(Controller, method)` — unified handler resolution for static, instance, and object controllers.
- `Routes.normalizeMiddleware(mw)` & `Routes.normalizeMiddlewareStrict(mw)` — unified middleware normalization: auto-wraps `handle()` classes/objects.
- Error propagation improved in all route/middleware paths — all `try/catch` blocks call `next(error)`.
- Core files (`src/routes.js` and `src/routes.mjs`) no longer log `console.error` internally, allowing `Routes.errorHandler` full control.

### 📦 Other

- All version strings updated to `3.0.0`.
- TypeScript types (`types/index.d.ts`) updated for all new APIs (including `MiddlewareChain`, `MethodMiddlewareMap`).
- All examples (`example/`) updated to demonstrate v3 features.
- All tests (`tests/`) rewritten for 100% v3 coverage: **67 tests passing**.
