import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import Routes from '../src/routes.mjs';

describe('Express Routing - ESM', () => {
    let app;
    let router;

    beforeEach(() => {
        Routes.routes = [];
        Routes.prefix = '';
        Routes.groupMiddlewares = [];
        Routes.globalMiddlewares = [];
        Routes._errorHandler = null;
        Routes._maintenanceMode = false;
        Routes._maintenanceHandler = null;

        app = express();
        router = express.Router();
        app.use(express.json());
    });

    const setupApp = async () => {
        await Routes.apply(app, router);
    };

    test('GET route with ESM', async () => {
        Routes.get('/esm-test', ({ res }) => res.json({ module: 'esm' }));
        await setupApp();
        expect((await request(app).get('/esm-test')).body.module).toBe('esm');
    });

    test('apply(app, router) auto-mounts', async () => {
        Routes.get('/auto', ({ res }) => res.json({ ok: true }));
        await Routes.apply(app, router);
        expect((await request(app).get('/auto')).body.ok).toBe(true);
    });

    test('async handler', async () => {
        Routes.get('/async', async ({ res }) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            res.json({ async: true });
        });
        await setupApp();
        expect((await request(app).get('/async')).body.async).toBe(true);
    });

    test('handle() middleware class', async () => {
        class HMw {
            static handle({ req, res, next }) { req.hit = true; next(); }
        }
        Routes.middleware([HMw], () => {
            Routes.get('/handle-mw', ({ req, res }) => res.json({ hit: req.hit }));
        });
        await setupApp();
        expect((await request(app).get('/handle-mw')).body.hit).toBe(true);
    });

    test('chaining: middleware().group()', async () => {
        class Mw { static handle({ req, res, next }) { req.chained = 'yes'; next(); } }
        Routes.middleware([Mw]).group('/ch', () => {
            Routes.get('/val', ({ req, res }) => res.json({ v: req.chained }));
        });
        await setupApp();
        expect((await request(app).get('/ch/val')).body.v).toBe('yes');
    });

    test('chaining: middleware().post()', async () => {
        class Mw { static handle({ req, res, next }) { req.c = true; next(); } }
        Routes.middleware([Mw]).post('/chain-post', ({ req, res }) => res.json({ c: req.c }));
        await setupApp();
        expect((await request(app).post('/chain-post')).body.c).toBe(true);
    });

    test('multiple HTTP methods', async () => {
        Routes.add(['get', 'post'], '/multi', ({ req, res }) => res.json({ method: req.method }));
        await setupApp();
        expect((await request(app).get('/multi')).body.method).toBe('GET');
        expect((await request(app).post('/multi')).body.method).toBe('POST');
    });

    test('ESM class controller [Controller, method]', async () => {
        class UserController {
            static list({ res }) { res.json({ users: ['Alice', 'Bob'] }); }
        }
        Routes.get('/users', [UserController, 'list']);
        await setupApp();
        expect((await request(app).get('/users')).body.users).toHaveLength(2);
    });

    test('controller() auto-routing with per-method middleware', async () => {
        class C {
            static index({ res }) { res.json({ from: 'index' }); }
            static myItems({ req, res }) { res.json({ from: 'my-items', auth: req.authed }); }
        }
        class AuthMw { static handle({ req, res, next }) { req.authed = true; next(); } }
        Routes.controller('esm-ctrl', C, { 'myItems': AuthMw });
        await setupApp();
        expect((await request(app).get('/esm-ctrl')).body.from).toBe('index');
        const itemsRes = await request(app).get('/esm-ctrl/my-items');
        expect(itemsRes.body.from).toBe('my-items');
        expect(itemsRes.body.auth).toBe(true);
    });

    test('Routes.errorHandler() receives error', async () => {
        Routes.get('/fail', () => { throw new Error('ESM error'); });
        Routes.errorHandler(({ res, error }) => {
            res.status(500).json({ caught: error.message });
        });
        await setupApp();
        expect((await request(app).get('/fail')).body.caught).toBe('ESM error');
    });

    test('maintenance mode returns 503', async () => {
        Routes.maintenance(true);
        await setupApp();
        expect((await request(app).get('/any')).status).toBe(503);
    });

    test('grouped routes', async () => {
        Routes.group('/api', () => {
            Routes.group('/v2', () => {
                Routes.get('/status', ({ res }) => res.json({ version: 2, status: 'ok' }));
            });
        });
        await setupApp();
        expect((await request(app).get('/api/v2/status')).body.version).toBe(2);
    });

    test('allRoutes() returns info', () => {
        Routes.get('/info1', ({ res }) => res.send('ok'));
        Routes.post('/info2', ({ res }) => res.send('ok'));
        const routes = Routes.allRoutes();
        expect(routes).toHaveLength(2);
        expect(routes[0].handlerType).toBe('function');
    });

    test('no console.error leak', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        Routes.get('/no-log', () => { throw new Error('silent'); });
        await setupApp();
        app.use((err, req, res, next) => res.status(500).json({}));
        await request(app).get('/no-log');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
