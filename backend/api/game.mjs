import backend from '../server.js';

await backend.initialize();

export const config = { maxDuration: 300 };
export default backend.server;
