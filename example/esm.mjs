import express from 'express';
import Routes from '../src/routes.mjs';

const app = express();
const router = express.Router();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Middleware Classes ────────────────────────────────────────────────────────

class AuthMiddleware {
    static handle({ req, res, next }) {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    }
}

const LogMiddleware = {
    handle({ req, res, next }) {
        console.log(`[ESM LOG] ${req.method} ${req.path}`);
        next();
    }
};

// ─── Routes ───────────────────────────────────────────────────────────────────

Routes.get('/', ({ res }) => {
    res.json({ message: 'ESM Example Server', version: '3.0.0', module: 'ESM' });
});

// Middleware class via handle() — new style
Routes.middleware([AuthMiddleware], () => {
    Routes.get('/protected', ({ res }) => {
        res.json({ message: 'Protected route — requires Authorization header', access: 'granted' });
    });
});

// Chaining: middleware().group()
Routes.middleware([LogMiddleware])
    .group('/log', () => {
        Routes.get('/info', ({ res }) => {
            res.json({ message: 'Logged route via chaining' });
        });
    });

Routes.group('/api', () => {
    Routes.get('/hello', ({ res }) => {
        res.json({ message: 'Hello from ESM!' });
    });

    Routes.post('/echo', ({ req, res }) => {
        res.json({ echo: req.body });
    });

    Routes.group('/users', () => {
        Routes.get('/', ({ res }) => {
            res.json({ users: ['Alice', 'Bob', 'Charlie'] });
        });
        Routes.get('/:id', ({ req, res }) => {
            res.json({ id: req.params.id, name: 'User ' + req.params.id });
        });
    });
});

// Controller auto-routing
class DataController {
    static index({ res }) {
        res.json({ data: [1, 2, 3, 4, 5], timestamp: new Date().toISOString() });
    }

    static async latestItems({ res }) {
        await new Promise(resolve => setTimeout(resolve, 50));
        res.json({ items: ['a', 'b', 'c'] });
    }

    static post_create({ req, res }) {
        res.status(201).json({ created: true, body: req.body });
    }
}

Routes.controller('data', DataController);

// Error handler
Routes.errorHandler(({ req, res, next, error }) => {
    res.status(error?.status || 500).json({
        error: error?.message || 'Internal Server Error',
        code: error?.status || 500,
    });
});

Routes.get('/routes', ({ res }) => {
    const allRoutes = Routes.allRoutes();
    res.json({ total: allRoutes.length, routes: allRoutes });
});

// Routes.apply(app, router) — auto mounts router on app
await Routes.apply(app, router);

app.listen(PORT, () => {
    console.log(`ESM Server running at http://localhost:${PORT}`);
    console.log('\nAvailable routes:');
    Routes.allRoutes().forEach(route => {
        console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`);
    });
});
