# Testing Guide — @refkinscallv/express-routing v3.0.0

## Running Tests

```bash
# All suites
npm test

# CommonJS only
npm run test:cjs

# ESM only
npm run test:esm

# TypeScript only
npm run test:ts
```

---

## Test Results Summary

| Suite | File | Tests |
|-------|------|-------|
| CommonJS | `tests/commonjs.test.js` | 42 |
| ESM | `tests/esm.test.mjs` | 12 |
| TypeScript | `tests/typescript.test.ts` | 13 |
| **Total** | | **67** |

All 67 tests pass. ✅

---

## Test Coverage

### CommonJS (`tests/commonjs.test.js`)

#### Basic Routes
- `GET`, `POST`, `PUT`, `DELETE`, `PATCH` routes
- `HttpContext.error` is `null` on normal requests

#### `apply(app, router)`
- Auto-mounts router on app — no `app.use(router)` needed
- Works without second argument (direct mount on app)

#### Route Groups
- Groups with prefix
- Nested groups

#### Middleware
- Plain function `(req, res, next)` — unchanged behavior
- Object with `handle({ req, res, next, error })` — new style
- Class with static `handle()` — new style
- `Routes.middleware([...], callback)` — scoped global
- `Routes.middleware([...])` with `handle()` class — auto-applied
- Middleware execution order: global → group → route
- Chaining: `Routes.middleware([...]).group(...)`

#### Controllers — `[Controller, method]` binding
- Static class methods
- Instance class methods
- Plain object methods

#### `Routes.controller()` — Auto-routing
- `index` → base path
- `camelCase` → `kebab-case`
- `PascalCase` → `kebab-case`
- `snake_case` → `kebab-case`
- `Singleword` → `singleword`
- HTTP prefix: `post_create` → `POST /base/create`
- Instance class controller
- Plain object controller

#### `Routes.errorHandler()`
- Inline function receives `{ req, res, next, error }`
- `[Controller, 'method']` binding

#### `Routes.maintenance()`
- Default 503 response
- Custom maintenance handler
- Routes work normally when maintenance is off

#### Error Handling
- Sync errors → `next(error)`
- Async errors → `next(error)`

#### Route Inspection
- `allRoutes()` returns all route info
- `middlewareCount` is accurate

#### Multiple Methods
- `Routes.add(['get', 'post'], ...)` — multi-method

#### Path Normalization
- Duplicate slashes normalized

#### `nameToPath()`
- `samplePath` → `sample-path`
- `SamplePath` → `sample-path`
- `sample_path` → `sample-path`
- `Samplepath` → `samplepath`

---

### ESM (`tests/esm.test.mjs`)

- GET route with ESM
- `apply(app, router)` auto-mounts
- Async handler
- `handle()` middleware class
- Chaining: `middleware().group()`
- Multiple HTTP methods
- ESM class controller `[Controller, method]`
- `controller()` auto-routing
- `Routes.errorHandler()` receives error
- Maintenance mode 503
- Grouped routes
- `allRoutes()` returns info

---

### TypeScript (`tests/typescript.test.ts`)

- TypeScript types work (`HttpContext`)
- `apply(app, router)` auto-mounts router
- `handle()` middleware class in TypeScript
- Chaining: `middleware().group()`
- `allRoutes()` returns typed `RouteInfo[]`
- `[Controller, method]` binding
- `controller()` auto-routing in TypeScript
- `Routes.errorHandler()` receives typed error
- Maintenance mode returns 503
- Async TypeScript handler
- Typed middleware (plain function)
- Grouped routes
- Middleware error passes to error handler

---

## Test Setup Pattern

Each test uses `beforeEach` to reset the Routes static state:

```js
beforeEach(() => {
    Routes.routes = []
    Routes.prefix = ''
    Routes.groupMiddlewares = []
    Routes.globalMiddlewares = []
    Routes._errorHandler = null
    Routes._maintenanceMode = false
    Routes._maintenanceHandler = null

    app = express()
    router = express.Router()
    app.use(express.json())
})

const setupApp = async () => {
    await Routes.apply(app, router)  // v3: auto mounts router
}
```

---

## Writing New Tests

### Route handler

```js
Routes.get('/my-route', ({ req, res, next, error }) => {
    res.json({ ok: true })
})
await setupApp()
const res = await request(app).get('/my-route')
expect(res.body.ok).toBe(true)
```

### Middleware with `handle()`

```js
class MyMw {
    static handle({ req, res, next }) {
        req.custom = 'value'
        next()
    }
}
Routes.middleware([MyMw], () => {
    Routes.get('/mw-test', ({ req, res }) => res.json({ v: req.custom }))
})
await setupApp()
expect((await request(app).get('/mw-test')).body.v).toBe('value')
```

### `Routes.controller()`

```js
class C {
    static index({ res }) { res.json({ ok: true }) }
    static myItems({ res }) { res.json({ items: [] }) }
    static post_save({ req, res }) { res.status(201).json({ saved: true }) }
}
Routes.controller('myctrl', C)
await setupApp()
// GET /myctrl         → index
// GET /myctrl/my-items → myItems
// POST /myctrl/save   → post_save
```

### Error handler

```js
Routes.get('/fail', () => { throw new Error('Boom') })
Routes.errorHandler(({ res, error }) => {
    res.status(500).json({ msg: error.message })
})
await setupApp()
expect((await request(app).get('/fail')).body.msg).toBe('Boom')
```

### Maintenance mode

```js
Routes.maintenance(true)
await setupApp()
expect((await request(app).get('/any')).status).toBe(503)
```
