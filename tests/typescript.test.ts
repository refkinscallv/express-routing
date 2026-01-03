import request from 'supertest';
import express, { Router, Request, Response, NextFunction } from 'express';
// Import the actual CommonJS implementation
const Routes = require('../index.js');
// Import only the types from the .d.ts file
import type { HttpContext, RouteInfo } from '../types/index';

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

    const setupApp = async (): Promise<void> => {
        await Routes.apply(router);
        app.use(router);
    };

    test('should work with TypeScript types', async () => {
        Routes.get('/typescript', ({ req, res }: HttpContext) => {
            res.json({ typed: true, path: req.path });
        });

        await setupApp();

        const response = await request(app).get('/typescript');
        expect(response.body.typed).toBe(true);
    });

    test('should type check route info', async () => {
        Routes.get('/info', ({ res }: HttpContext) => {
            res.send('ok')
        });
        Routes.post('/create', ({ res }: HttpContext) => {
            res.send('created')
        });

        const routes: RouteInfo[] = Routes.allRoutes();
        expect(routes[0].path).toBe('/info');
        expect(routes[0].handlerType).toBe('function');
        expect(routes[1].methods).toContain('post');
    });

    test('should type check controller', async () => {
        class UserController {
            static index({ res }: HttpContext): void {
                res.json({ users: [] });
            }

            static show({ req, res }: HttpContext): void {
                res.json({ id: req.params.id });
            }
        }

        Routes.get('/users', [UserController, 'index']);
        Routes.get('/users/:id', [UserController, 'show']);

        await setupApp();

        const response = await request(app).get('/users');
        expect(response.body.users).toEqual([]);

        const showResponse = await request(app).get('/users/123');
        expect(showResponse.body.id).toBe('123');
    });

    test('should handle typed middleware', async () => {
        const authMiddleware = (
            req: Request,
            res: Response,
            next: NextFunction
        ): void => {
            (req as any).authenticated = true;
            next();
        };

        Routes.post('/auth', ({ req, res }: HttpContext) => {
            res.json({ auth: (req as any).authenticated });
        }, [authMiddleware]);

        await setupApp();

        const response = await request(app).post('/auth');
        expect(response.body.auth).toBe(true);
    });

    test('should handle async TypeScript handlers', async () => {
        Routes.get('/async-ts', async ({ res }: HttpContext) => {
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            res.json({ success: true });
        });

        await setupApp();

        const response = await request(app).get('/async-ts');
        expect(response.body.success).toBe(true);
    });

    test('should type check grouped routes', async () => {
        Routes.group('/api', () => {
            Routes.get('/status', ({ res }: HttpContext) => {
                res.json({ status: 'operational' });
            });
        });

        await setupApp();

        const response = await request(app).get('/api/status');
        expect(response.body.status).toBe('operational');
    });

    test('should handle typed error in middleware', async () => {
        const errorMiddleware = (
            req: Request,
            res: Response,
            next: NextFunction
        ): void => {
            next(new Error('Middleware error'));
        };

        Routes.get('/error-mw', ({ res }: HttpContext) => {
            res.send('ok');
        }, [errorMiddleware]);

        await setupApp();

        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            res.status(500).json({ error: err.message });
        });

        const response = await request(app).get('/error-mw');
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Middleware error');
    });
});
