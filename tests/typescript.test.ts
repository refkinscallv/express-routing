import request from 'supertest';
import express, { Router, Request, Response, NextFunction, Application } from 'express';
const Routes = require('../index.js');
import type { HttpContext, RouteInfo } from '../types/index';

describe('Express Routing - TypeScript', () => {
    let app: Application;
    let router: Router;

    beforeEach(() => {
        Routes.routes = [];
        Routes.prefix = '';
        Routes.groupMiddlewares = [];
        Routes.globalMiddlewares = [];
        Routes._errorHandler = null;
        Routes._maintenanceMode = false;
        Routes._maintenanceHandler = null;

        app = express();
        router = Router();
        app.use(express.json());
    });

    const setupApp = async (): Promise<void> => {
        await Routes.apply(app, router);
    };

    test('TypeScript types work', async () => {
        Routes.get('/typescript', ({ req, res }: HttpContext) => {
            res.json({ typed: true, path: req.path });
        });
        await setupApp();
        expect((await request(app).get('/typescript')).body.typed).toBe(true);
    });

    test('apply(app, router) auto-mounts router', async () => {
        Routes.get('/ts-mount', ({ res }: HttpContext) => res.json({ ok: true }));
        await Routes.apply(app, router);
        expect((await request(app).get('/ts-mount')).body.ok).toBe(true);
    });

    test('handle() middleware class in TypeScript', async () => {
        class AuthMw {
            static handle({ req, res, next }: HttpContext): void {
                (req as any).authed = true;
                next();
            }
        }
        Routes.middleware([AuthMw], () => {
            Routes.get('/ts-authed', ({ req, res }: HttpContext) => {
                res.json({ authed: (req as any).authed });
            });
        });
        await setupApp();
        expect((await request(app).get('/ts-authed')).body.authed).toBe(true);
    });

    test('chaining: middleware().group()', async () => {
        class Mw {
            static handle({ req, res, next }: HttpContext): void {
                (req as any).chained = true;
                next();
            }
        }
        Routes.middleware([Mw]).group('/ts-chain', () => {
            Routes.get('/val', ({ req, res }: HttpContext) => {
                res.json({ chained: (req as any).chained });
            });
        });
        await setupApp();
        expect((await request(app).get('/ts-chain/val')).body.chained).toBe(true);
    });

    test('chaining: middleware().post()', async () => {
        class Mw {
            static handle({ req, res, next }: HttpContext): void {
                (req as any).c = true;
                next();
            }
        }
        Routes.middleware([Mw]).post('/ts-chain-post', ({ req, res }: HttpContext) => {
            res.json({ c: (req as any).c });
        });
        await setupApp();
        expect((await request(app).post('/ts-chain-post')).body.c).toBe(true);
    });

    test('allRoutes() returns typed RouteInfo[]', () => {
        Routes.get('/info', ({ res }: HttpContext) => res.send('ok'));
        Routes.post('/create', ({ res }: HttpContext) => res.send('created'));
        const routes: RouteInfo[] = Routes.allRoutes();
        expect(routes[0].path).toBe('/info');
        expect(routes[0].handlerType).toBe('function');
        expect(routes[1].methods).toContain('post');
    });

    test('[Controller, method] binding', async () => {
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
        expect((await request(app).get('/users')).body.users).toEqual([]);
        expect((await request(app).get('/users/123')).body.id).toBe('123');
    });

    test('controller() auto-routing with per-method middleware in TypeScript', async () => {
        class C {
            static index({ res }: HttpContext): void { res.json({ ts: 'index' }); }
            static myProfile({ req, res }: HttpContext): void { res.json({ ts: 'my-profile', authed: (req as any).authed }); }
            static post_store({ req, res }: HttpContext): void { res.status(201).json({ stored: true }); }
        }
        class AuthMw {
            static handle({ req, res, next }: HttpContext): void {
                (req as any).authed = true;
                next();
            }
        }
        Routes.controller('ts-ctrl', C, {
            'myProfile': AuthMw
        });
        await setupApp();
        expect((await request(app).get('/ts-ctrl')).body.ts).toBe('index');
        const profileRes = await request(app).get('/ts-ctrl/my-profile');
        expect(profileRes.body.ts).toBe('my-profile');
        expect(profileRes.body.authed).toBe(true);
        expect((await request(app).post('/ts-ctrl/store')).status).toBe(201);
    });

    test('Routes.errorHandler() receives typed error', async () => {
        Routes.get('/ts-err', (): void => { throw new Error('TS error'); });
        Routes.errorHandler(({ res, error }: HttpContext): void => {
            res.status(500).json({ caught: error?.message });
        });
        await setupApp();
        expect((await request(app).get('/ts-err')).body.caught).toBe('TS error');
    });

    test('maintenance mode returns 503', async () => {
        Routes.maintenance(true);
        await setupApp();
        expect((await request(app).get('/any')).status).toBe(503);
    });

    test('async TypeScript handler', async () => {
        Routes.get('/async-ts', async ({ res }: HttpContext): Promise<void> => {
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            res.json({ success: true });
        });
        await setupApp();
        expect((await request(app).get('/async-ts')).body.success).toBe(true);
    });

    test('typed middleware (plain function)', async () => {
        const authMw = (req: Request, res: Response, next: NextFunction): void => {
            (req as any).authenticated = true;
            next();
        };
        Routes.post('/auth', ({ req, res }: HttpContext) => {
            res.json({ auth: (req as any).authenticated });
        }, [authMw]);
        await setupApp();
        expect((await request(app).post('/auth')).body.auth).toBe(true);
    });

    test('grouped routes', async () => {
        Routes.group('/api', () => {
            Routes.get('/status', ({ res }: HttpContext) => {
                res.json({ status: 'operational' });
            });
        });
        await setupApp();
        expect((await request(app).get('/api/status')).body.status).toBe('operational');
    });

    test('no console.error leaks', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const errorMw = (req: Request, res: Response, next: NextFunction): void => {
            next(new Error('Middleware error'));
        };
        Routes.get('/error-mw', ({ res }: HttpContext) => res.send('ok'), [errorMw]);
        await setupApp();
        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            res.status(500).json({ error: err.message });
        });
        const response = await request(app).get('/error-mw');
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Middleware error');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
