import express, { Router, Request, Response, NextFunction, Application } from 'express';
import Routes, { HttpContext, RouteInfo, MiddlewareClass } from '../types/index';

const app: Application = express();
const router: Router = Router();
const PORT: number = parseInt(process.env.PORT || '3002', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    id: number;
    name: string;
    email: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const users: User[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
];

// ─── Middleware classes (new style — implement handle()) ───────────────────────

class LogMiddleware implements MiddlewareClass {
    handle({ req, res, next }: HttpContext): void {
        console.log(`[TS LOG] ${req.method} ${req.path}`);
        next();
    }
}

class AuthMiddleware {
    static handle({ req, res, next }: HttpContext): void {
        const token = req.headers.authorization;
        if (!token) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        next();
    }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Scoped global middleware via handle() — new style
Routes.middleware([LogMiddleware], () => {
    Routes.get('/', ({ res }: HttpContext): void => {
        res.json({ message: 'TypeScript Example Server', version: '3.0.0', language: 'TypeScript' });
    });

    Routes.group('/api', () => {
        Routes.get('/users', ({ res }: HttpContext): void => {
            res.json({ users });
        });

        Routes.get('/users/:id', ({ req, res }: HttpContext): void => {
            const id = parseInt(req.params.id, 10);
            const user = users.find(u => u.id === id);
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            res.json({ user });
        });

        Routes.post('/users', ({ req, res }: HttpContext): void => {
            const newUser: User = {
                id: users.length + 1,
                name: req.body.name,
                email: req.body.email,
            };
            users.push(newUser);
            res.status(201).json({ user: newUser });
        });
    });
});

// Chaining: middleware().group()
Routes.middleware([AuthMiddleware])
    .group('/secured', () => {
        Routes.get('/profile', ({ res }: HttpContext): void => {
            res.json({ message: 'Secured profile route' });
        });
    });

// Auto-routing from controller
class StatsController {
    static index({ res }: HttpContext): void {
        res.json({ totalUsers: users.length, totalRoutes: Routes.allRoutes().length });
    }

    static async asyncStats({ res }: HttpContext): Promise<void> {
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        res.json({ status: 'processed', users: users.length });
    }

    static post_reset({ req, res }: HttpContext): void {
        res.json({ reset: true });
    }
}

Routes.controller('stats', StatsController);

// Error handler (receives { req, res, next, error })
Routes.errorHandler(({ req, res, next, error }: HttpContext): void => {
    console.error('[ErrorHandler]', error?.message);
    res.status((error as any)?.status || 500).json({
        error: error?.message || 'Internal Server Error',
    });
});

Routes.get('/routes', ({ res }: HttpContext): void => {
    const allRoutes: RouteInfo[] = Routes.allRoutes();
    res.json({ total: allRoutes.length, routes: allRoutes });
});

// ─── Apply ────────────────────────────────────────────────────────────────────

(async () => {
    // New API: auto mounts router on app
    await Routes.apply(app, router);

    app.listen(PORT, () => {
        console.log(`TypeScript Server running at http://localhost:${PORT}`);
        console.log('\nAvailable routes:');
        Routes.allRoutes().forEach(route => {
            console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`);
        });
    });
})();
