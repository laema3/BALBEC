import serverless from 'serverless-http';
const app = require('../dist/server.cjs');

export default serverless(app.default || app);

