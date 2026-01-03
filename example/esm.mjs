import express from 'express';
import Routes from '../src/routes.mjs';

const app = express();
const router = express.Router();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

Routes.get('/', ({ res }) => {
    res.json({
        message: 'ESM Example Server',
        version: '2.0.1',
        module: 'ESM'
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

Routes.middleware([authMiddleware], () => {
    Routes.get('/protected', ({ res }) => {
        res.json({ message: 'This is protected', access: 'granted' });
    });
});

class DataController {
    static async getData({ res }) {
        await new Promise(resolve => setTimeout(resolve, 100));
        res.json({
            data: [1, 2, 3, 4, 5],
            timestamp: new Date().toISOString()
        });
    }
}

Routes.get('/data', [DataController, 'getData']);

Routes.get('/routes', ({ res }) => {
    const allRoutes = Routes.allRoutes();
    res.json({
        total: allRoutes.length,
        routes: allRoutes
    });
});

await Routes.apply(router);
app.use(router);

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        error: err.message
    });
});

app.listen(PORT, () => {
    console.log(`ESM Server running at http://localhost:${PORT}`);
    console.log('\nAvailable routes:');
    Routes.allRoutes().forEach(route => {
        console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`);
    });
});
