# Changelog

All notable changes to `@refkinscallv/express-routing` will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
