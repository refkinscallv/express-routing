# Changelog

All notable changes to `@refkinscallv/express-routing` will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
