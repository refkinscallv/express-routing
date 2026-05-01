const express = require('express');
const Routes = require('../src/routes');

require('./web');

const PORT = process.env.PORT || 3000;
const app = express();
const router = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// New API: Routes.apply(app, router) — no need to call app.use(router) separately
Routes.apply(app, router).then(() => {
    // Fallback Express error handler (in case Routes.errorHandler is not set)
    app.use((err, req, res, next) => {
        console.error('Unhandled Error:', err.message);
        res.status(err.status || 500).json({
            error: err.message,
            status: err.status || 500,
        });
    });

    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
        console.log('\nAvailable routes:');
        Routes.allRoutes().forEach(route => {
            console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`);
        });
    });
});
