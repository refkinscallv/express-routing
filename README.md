# 🔁 Express Routing by Refkinscallv

Laravel-style routing for Express apps — finally something you **actually enjoy** using in Node.js.

> Simple, readable, and middleware-friendly like your favorite PHP framework... but with JavaScript's async power.

---

## 🚀 Installation

```bash
npm install refkinscallv/express-routing
```

---

## 📦 Features

- Grouped routes like Laravel
- Middleware support (single or grouped)
- Controller-like handlers (`[Class, 'method']`)
- Clean and minimal route definitions
- Fully compatible with Express

---

## ⚙️ Quick Start

### 1. Setup your app

```js
// example/index.js
const express = require('express')
const http = require('http')
const Routes = require('express-routing') // or require('../src/routes')

const app = express()
const router = express.Router()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

require('./web') // define your routes here
Routes.apply(router) // apply all routes
app.use(router)

http.createServer(app).listen(3000, () => {
    console.log('Server running at http://localhost:3000')
})
```

### 2. Define routes like a boss

```js
// example/web.js
const Routes = require('express-routing')

class SampleController {
    static index({ res }) {
        res.json({ status: true, message: 'Hello from SampleController' })
    }
}

const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization']
    if (token !== 'Bearer mysecrettoken') {
        return res.status(401).json({ status: false, message: 'Unauthorized' })
    }
    next()
}

Routes.get('/', ({ res }) => res.send('Hello World!'))
Routes.get('/sample', SampleController.index)
Routes.get('/sample-auth', [SampleController, 'index'], [authMiddleware])

Routes.group('/grouped', () => {
    Routes.get('/one', SampleController.index)
    Routes.get('/two', [SampleController, 'index'])
})

Routes.group('/secure', () => {
    Routes.get('/check', [SampleController, 'index'])
}, [authMiddleware])
```

---

## 🧠 API Reference

### `Routes.get|post|put|delete|patch(path, handler, middlewares = [])`
Register a single route. Handler can be:
- A function: `({ req, res }) => {}`
- A callable descriptor: `[Class/Object, 'methodName']`

### `Routes.group(prefix, callback, middlewares = [])`
Group routes under a common prefix and shared middleware.

```js
Routes.group('/admin', () => {
    Routes.get('/dashboard', AdminController.dashboard)
}, [authMiddleware])
```

### `Routes.apply(router)`
Applies all defined routes into the given Express router.

---

## ✅ Handler Flexibility

```js
Routes.get('/a', ({ res }) => res.send('Inline function'))

Routes.get('/b', SampleController.index) // static method

Routes.get('/c', [SampleController, 'index']) // as descriptor

const Obj = {
    index: ({ res }) => res.send('From object method')
}
Routes.get('/d', [Obj, 'index'])
```

---

## 🛡 Middleware Support

```js
const auth = (req, res, next) => { /* ... */ }

Routes.get('/private', SampleController.index, [auth])

Routes.group('/secure', () => {
    Routes.get('/data', SampleController.index)
}, [auth])
```

---

## 🧪 Run the example

```bash
npm run example
```

> Open [http://localhost:3000](http://localhost:3000)

---

---

## 📝 License

MIT — Refkinscallv © 2025

---

## 👋 Say Hello

Made with ❤️ by [Refkinscallv](mailto:refkinscallv@gmail.com)

Follow us for more tools that make your Node.js life easier 😉