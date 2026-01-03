import express, { Router, Request, Response, NextFunction } from 'express';
import Routes, { HttpContext } from '../types/index';

const app = express();
const router: Router = Router();
const PORT: number = parseInt(process.env.PORT || '3002', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

interface User {
    id: number;
    name: string;
    email: string;
}

const users: User[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
];

const logMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
};

const validateId = (req: Request, res: Response, next: NextFunction): void => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
    }
    next();
};

Routes.middleware([logMiddleware], () => {
    Routes.get('/', ({ res }: HttpContext): void => {
        res.json({
            message: 'TypeScript Example Server',
            version: '2.0.1',
            language: 'TypeScript'
        });
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
        }, [validateId]);

        Routes.post('/users', ({ req, res }: HttpContext): void => {
            const newUser: User = {
                id: users.length + 1,
                name: req.body.name,
                email: req.body.email
            };
            users.push(newUser);
            res.status(201).json({ user: newUser });
        });
    });
});

class StatsController {
    static getStats({ res }: HttpContext): void {
        res.json({
            totalUsers: users.length,
            totalRoutes: Routes.allRoutes().length,
            timestamp: new Date().toISOString()
        });
    }

    static async getAsyncStats({ res }: HttpContext): Promise<void> {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        
        res.json({
            status: 'processed',
            users: users.length,
            routes: Routes.allRoutes().length
        });
    }
}

Routes.get('/stats', [StatsController, 'getStats']);
Routes.get('/stats/async', [StatsController, 'getAsyncStats']);

Routes.get('/routes', ({ res }: HttpContext): void => {
    const allRoutes = Routes.allRoutes();
    res.json({
        total: allRoutes.length,
        routes: allRoutes
    });
});

(async () => {
    await Routes.apply(router);
    app.use(router);

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('Error:', err.message);
        res.status(500).json({
            error: err.message
        });
    });

    app.listen(PORT, () => {
        console.log(`TypeScript Server running at http://localhost:${PORT}`);
        console.log('\nAvailable routes:');
        Routes.allRoutes().forEach(route => {
            console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`);
        });
    });
})();
