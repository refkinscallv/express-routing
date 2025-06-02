# 📦 @refkinscallv/express-routing

Laravel-style routing system for Express.js in JavaScript. Clean route definitions, middleware support, and controller bindings — just like your favorite PHP framework, but in JS.

---

## 🛠 Installation

```bash
npm install @refkinscallv/express-routing
````

---

## 🧪 Example Usage

Check out [`example/index.js`](./example/index.js) for a full working demo of how this works in a real-world Express app.

---

## 📚 Features

* ✅ Simple and clean route declarations (`get`, `post`, etc.)
* ✅ Grouped routes with prefix
* ✅ Middleware stack: per-route and group-level
* ✅ Controller-method pair as route handler
* ✅ Supports `HttpContext` style handlers: `{ req, res, next }`
* ✅ Auto-binds controller methods
* ✅ Fully Express-compatible

---

## ✨ Usage

### 🔹 1. Basic Route

```js
Routes.get('/hello', ({ res }) => {
  res.send('Hello World')
})
```

### 🔹 2. With Middleware

```js
const authMiddleware = (req, res, next) => {
  // auth logic
  next()
}

Routes.post('/secure', ({ res }) => res.send('Protected'), [authMiddleware])
```

---

### 🔹 3. Controller Binding

```js
class UserController {
  static index({ res }) {
    res.send('User List')
  }
}

Routes.get('/users', [UserController, 'index'])
```

> ⚠️ Class-based handlers will auto-bind to static or instance methods.

---

### 🔹 4. Grouped Routes

```js
Routes.group('/admin', () => {
  Routes.get('/dashboard', ({ res }) => res.send('Admin Panel'))
})
```

With middleware:

```js
Routes.group('/secure', () => {
  Routes.get('/data', ({ res }) => res.send('Secure Data'))
}, [authMiddleware])
```

---

### 🔹 5. Global Middleware Scope

```js
Routes.middleware([authMiddleware], () => {
  Routes.get('/profile', ({ res }) => res.send('My Profile'))
})
```

---

### 🔹 6. Apply to Express

```js
const express = require('express')
const Routes = require('@refkinscallv/express-routing')

const app = express()
const router = express.Router()

// Register your routes
require('./routes')

Routes.apply(router)
app.use(router)

app.listen(3000, () => {
  console.log('Server is running at http://localhost:3000')
})
```

---

## 📖 API Reference

### 📌 Routes Methods

| Method      | Description                       |
| ----------- | --------------------------------- |
| `get()`     | Register a GET route              |
| `post()`    | Register a POST route             |
| `put()`     | Register a PUT route              |
| `patch()`   | Register a PATCH route            |
| `delete()`  | Register a DELETE route           |
| `options()` | Register an OPTIONS route         |
| `head()`    | Register a HEAD route             |
| `add()`     | Register multiple methods at once |

---

### 📌 Static Methods

| Method                | Description                                      |
| --------------------- | ------------------------------------------------ |
| `Routes.get()`        | Register a GET route                             |
| `Routes.post()`       | Register a POST route                            |
| `Routes.put()`        | Register a PUT route                             |
| `Routes.delete()`     | Register a DELETE route                          |
| `Routes.patch()`      | Register a PATCH route                           |
| `Routes.options()`    | Register an OPTIONS route                        |
| `Routes.head()`       | Register a HEAD route                            |
| `Routes.add()`        | Register one or more HTTP methods at once        |
| `Routes.group()`      | Group routes under a prefix and share middleware |
| `Routes.middleware()` | Apply global middleware scope to nested routes   |
| `Routes.apply()`      | Apply all defined routes to an Express router    |

---

## 📌 Execution Flow

Middleware execution order:

```
[ Global Middleware ] → [ Group Middleware ] → [ Route Middleware ]
```

Handler execution:

* If function → executed directly
* If `[Controller, 'method']` → auto-instantiated (if needed), method is called

---

## 🧠 Tips

* All route paths are cleaned automatically to avoid double slashes (`//` → `/`)
* Controller methods are auto-bound (no `bind()` needed)
* Handlers support `async`/Promise usage
* Middleware order matters, just like native Express

---

## 🧪 Run Example

```bash
npm run example
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## 📝 License

MIT License © 2025 Refkinscallv

---

## 👋 Stay in Touch

Made with ❤️ by [Refkinscallv](mailto:refkinscallv@gmail.com)
Follow us for more tools that simplify Node.js development.