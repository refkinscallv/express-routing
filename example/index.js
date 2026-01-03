const express = require('express');
const Routes = require('../src/routes');

require('./web');

const PORT = process.env.PORT || 3000;
const app = express();
const router = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

Routes.apply(router);
app.use(router);

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        error: err.message,
        status: err.status || 500
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log('\nAvailable routes:');
    const routes = Routes.allRoutes();
    routes.forEach(route => {
        console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`);
    });
});
