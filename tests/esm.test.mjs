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

    const setupApp = async () => {
        await Routes.apply(router);
        app.use(router);
    };

    test('should register GET route with ESM', async () => {
        Routes.get('/esm-test', ({ res }) => {
            res.json({ module: 'esm' });
        });

        await setupApp();

        const response = await request(app).get('/esm-test');
        expect(response.status).toBe(200);
        expect(response.body.module).toBe('esm');
    });

    test('should handle async handlers', async () => {
        Routes.get('/async', async ({ res }) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            res.json({ async: true });
        });

        await setupApp();

        const response = await request(app).get('/async');
        expect(response.body.async).toBe(true);
    });

    test('should support multiple methods', async () => {
        Routes.add(['get', 'post'], '/multi', ({ req, res }) => {
            res.json({ method: req.method });
        });

        await setupApp();

        const getResponse = await request(app).get('/multi');
        expect(getResponse.body.method).toBe('GET');

        const postResponse = await request(app).post('/multi');
        expect(postResponse.body.method).toBe('POST');
    });

    test('should work with ESM class controllers', async () => {
        class UserController {
            static list({ res }) {
                res.json({ users: ['Alice', 'Bob'] });
            }
        }

        Routes.get('/users', [UserController, 'list']);

        await setupApp();

        const response = await request(app).get('/users');
        expect(response.body.users).toHaveLength(2);
    });

    test('should handle grouped routes in ESM', async () => {
        Routes.group('/api', () => {
            Routes.group('/v2', () => {
                Routes.get('/status', ({ res }) => {
                    res.json({ version: 2, status: 'ok' });
                });
            });
        });

        await setupApp();

        const response = await request(app).get('/api/v2/status');
        expect(response.body.version).toBe(2);
    });

    test('should return route information', async () => {
        Routes.get('/info1', ({ res }) => res.send('ok'));
        Routes.post('/info2', ({ res }) => res.send('ok'));

        const routes = Routes.allRoutes();
        expect(routes).toHaveLength(2);
        expect(routes[0].handlerType).toBe('function');
    });
});
