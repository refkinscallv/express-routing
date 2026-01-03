# Testing Guide

Comprehensive testing guide for @refkinscallv/express-routing

## Table of Contents

- [Test Setup](#test-setup)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [CommonJS Tests](#commonjs-tests)
- [ESM Tests](#esm-tests)
- [TypeScript Tests](#typescript-tests)
- [Writing Custom Tests](#writing-custom-tests)

## Test Setup

### Prerequisites

```bash
npm install
```

This will install all required dependencies including:
- jest (test framework)
- supertest (HTTP testing)
- typescript & ts-node (TypeScript support)

### Configuration Files

#### jest.config.js

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.mjs',
    '**/tests/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  }
};
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "types": ["node", "jest"]
  },
  "include": ["tests/**/*", "types/**/*", "example/**/*"],
  "exclude": ["node_modules"]
}
```

## Running Tests

### All Tests

```bash
npm test
```

This runs all test suites: CommonJS, ESM, and TypeScript.

### Individual Test Suites

```bash
# CommonJS only
npm run test:cjs

# ESM only
npm run test:esm

# TypeScript only
npm run test:ts
```

### Watch Mode

```bash
# Watch CommonJS tests
npx jest --watch tests/commonjs.test.js

# Watch ESM tests
NODE_OPTIONS=--experimental-vm-modules npx jest --watch tests/esm.test.mjs

# Watch TypeScript tests
npx jest --watch tests/typescript.test.ts
```

### Coverage

```bash
npx jest --coverage
```

## Test Structure

All tests follow a similar structure testing:

1. Basic route registration (GET, POST, PUT, DELETE, PATCH)
2. Route grouping
3. Middleware application (global, group, route-level)
4. Controller bindings (static and instance)
5. Error handling
6. Route inspection with `allRoutes()`

## CommonJS Tests

File: `tests/commonjs.test.js`

### Example Test

```javascript
const request = require('supertest');
const express = require('express');
const Routes = require('../src/routes');

describe('Express Routing - CommonJS', () => {
  let app;
  let router;

  beforeEach(() => {
    // Reset routes before each test
    Routes.routes = [];
    Routes.prefix = '';
    Routes.groupMiddlewares = [];
    Routes.globalMiddlewares = [];

    app = express();
    router = express.Router();
    app.use(express.json());
  });

  afterEach(() => {
    Routes.apply(router);
    app.use(router);
  });

  test('should register and handle GET route', async () => {
    Routes.get('/test', ({ res }) => {
      res.json({ message: 'success' });
    });

    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('success');
  });

  test('should apply middleware correctly', async () => {
    const middleware = (req, res, next) => {
      req.customValue = 'middleware-applied';
      next();
    };

    Routes.get('/middleware-test', ({ req, res }) => {
      res.json({ value: req.customValue });
    }, [middleware]);

    const response = await request(app).get('/middleware-test');
    expect(response.body.value).toBe('middleware-applied');
  });

  test('should handle route groups', async () => {
    Routes.group('/api', () => {
      Routes.get('/users', ({ res }) => {
        res.json({ route: 'users' });
      });
    });

    const response = await request(app).get('/api/users');
    expect(response.status).toBe(200);
    expect(response.body.route).toBe('users');
  });

  test('should bind controller methods', async () => {
    class TestController {
      static index({ res }) {
        res.json({ controller: 'static' });
      }
    }

    Routes.get('/controller', [TestController, 'index']);

    const response = await request(app).get('/controller');
    expect(response.body.controller).toBe('static');
  });

  test('should handle errors properly', async () => {
    Routes.get('/error', () => {
      throw new Error('Test error');
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Test error');
  });

  test('should return all routes info', () => {
    Routes.get('/route1', ({ res }) => res.send('ok'));
    Routes.post('/route2', ({ res }) => res.send('ok'));

    const allRoutes = Routes.allRoutes();
    expect(allRoutes).toHaveLength(2);
    expect(allRoutes[0].methods).toContain('get');
    expect(allRoutes[0].path).toBe('/route1');
    expect(allRoutes[1].methods).toContain('post');
  });
});
```

## ESM Tests

File: `tests/esm.test.mjs`

### Example Test

```javascript
import request from 'supertest';
import express from 'express';
import Routes from '../src/routes.mjs';

describe('Express Routing - ESM', () => {
  let app;
  let router;

  beforeEach(() => {
    Routes.routes = [];
    Routes.prefix = '';
    Routes.groupMiddlewares = [];
    Routes.globalMiddlewares = [];

    app = express();
    router = express.Router();
    app.use(express.json());
  });

  afterEach(async () => {
    await Routes.apply(router);
    app.use(router);
  });

  test('should register GET route with ESM', async () => {
    Routes.get('/esm-test', ({ res }) => {
      res.json({ module: 'esm' });
    });

    const response = await request(app).get('/esm-test');
    expect(response.status).toBe(200);
    expect(response.body.module).toBe('esm');
  });

  test('should handle async handlers', async () => {
    Routes.get('/async', async ({ res }) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      res.json({ async: true });
    });

    const response = await request(app).get('/async');
    expect(response.body.async).toBe(true);
  });

  test('should support multiple methods', async () => {
    Routes.add(['get', 'post'], '/multi', ({ req, res }) => {
      res.json({ method: req.method });
    });

    const getResponse = await request(app).get('/multi');
    expect(getResponse.body.method).toBe('GET');

    const postResponse = await request(app).post('/multi');
    expect(postResponse.body.method).toBe('POST');
  });
});
```

### Running ESM Tests

ESM tests require special Node.js flags:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/esm.test.mjs
```

Or use the npm script:

```bash
npm run test:esm
```

## TypeScript Tests

File: `tests/typescript.test.ts`

### Example Test

```typescript
import request from 'supertest';
import express, { Router } from 'express';
import Routes, { HttpContext, RouteInfo } from '../types/index';

describe('Express Routing - TypeScript', () => {
  let app: express.Application;
  let router: Router;

  beforeEach(() => {
    Routes.routes = [];
    Routes.prefix = '';
    Routes.groupMiddlewares = [];
    Routes.globalMiddlewares = [];

    app = express();
    router = Router();
    app.use(express.json());
  });

  afterEach(async () => {
    await Routes.apply(router);
    app.use(router);
  });

  test('should work with TypeScript types', async () => {
    Routes.get('/typescript', ({ req, res }: HttpContext) => {
      res.json({ typed: true });
    });

    const response = await request(app).get('/typescript');
    expect(response.body.typed).toBe(true);
  });

  test('should type check route info', () => {
    Routes.get('/info', ({ res }: HttpContext) => res.send('ok'));

    const routes: RouteInfo[] = Routes.allRoutes();
    expect(routes[0].path).toBe('/info');
    expect(routes[0].handlerType).toBe('function');
  });

  test('should type check controller', async () => {
    class UserController {
      static index({ res }: HttpContext): void {
        res.json({ users: [] });
      }
    }

    Routes.get('/users', [UserController, 'index']);

    const response = await request(app).get('/users');
    expect(response.body.users).toEqual([]);
  });

  test('should handle typed middleware', async () => {
    const authMiddleware = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      req.body.authenticated = true;
      next();
    };

    Routes.post('/auth', ({ req, res }: HttpContext) => {
      res.json({ auth: req.body.authenticated });
    }, [authMiddleware]);

    const response = await request(app).post('/auth');
    expect(response.body.auth).toBe(true);
  });
});
```

### Running TypeScript Tests

```bash
npm run test:ts
```

Or directly:

```bash
npx ts-node tests/typescript.test.ts
```

## Writing Custom Tests

### Test Template

```javascript
const request = require('supertest');
const express = require('express');
const Routes = require('@refkinscallv/express-routing');

describe('My Custom Tests', () => {
  let app;
  let router;

  beforeEach(() => {
    // Reset Routes state
    Routes.routes = [];
    Routes.prefix = '';
    Routes.groupMiddlewares = [];
    Routes.globalMiddlewares = [];

    // Create fresh Express app and router
    app = express();
    router = express.Router();
    app.use(express.json());
  });

  afterEach(async () => {
    // Apply routes after each test
    await Routes.apply(router);
    app.use(router);
  });

  test('your test description', async () => {
    // Define routes
    Routes.get('/test', ({ res }) => {
      res.json({ success: true });
    });

    // Make request
    const response = await request(app).get('/test');

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### Testing Best Practices

1. **Always reset Routes state** before each test to avoid conflicts
2. **Use beforeEach and afterEach** for setup and teardown
3. **Test both success and error cases**
4. **Test middleware execution order**
5. **Test edge cases** (empty paths, invalid handlers, etc.)
6. **Use descriptive test names**

### Example: Testing Middleware Order

```javascript
test('should execute middlewares in correct order', async () => {
  const order = [];

  const mw1 = (req, res, next) => {
    order.push('global');
    next();
  };

  const mw2 = (req, res, next) => {
    order.push('group');
    next();
  };

  const mw3 = (req, res, next) => {
    order.push('route');
    next();
  };

  Routes.middleware([mw1], () => {
    Routes.group('/api', () => {
      Routes.get('/test', ({ res }) => {
        res.json({ order });
      }, [mw3]);
    }, [mw2]);
  });

  const response = await request(app).get('/api/test');
  expect(response.body.order).toEqual(['global', 'group', 'route']);
});
```

### Example: Testing Error Handling

```javascript
test('should pass errors to Express error handler', async () => {
  Routes.get('/error', () => {
    throw new Error('Custom error');
  });

  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  });

  const response = await request(app).get('/error');
  expect(response.status).toBe(500);
  expect(response.body.error).toBe('Custom error');
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [14.x, 16.x, 18.x, 20.x]

    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - run: npm ci
    - run: npm test
    - run: npm run build
```

## Troubleshooting

### ESM Tests Not Running

Make sure you're using the correct Node.js flags:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/esm.test.mjs
```

### TypeScript Type Errors

Ensure you have proper TypeScript configuration:

```bash
npm install --save-dev typescript @types/node @types/express @types/jest
```

### Test Isolation Issues

If tests are affecting each other, make sure you're resetting Routes state:

```javascript
beforeEach(() => {
  Routes.routes = [];
  Routes.prefix = '';
  Routes.groupMiddlewares = [];
  Routes.globalMiddlewares = [];
});
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Express Testing Guide](https://expressjs.com/en/guide/testing.html)
- [TypeScript Testing](https://jestjs.io/docs/getting-started#via-ts-node)
