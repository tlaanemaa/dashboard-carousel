#!/usr/bin/env node
global.isRunAsCLI = true;
const port = process.env.PORT || 8080;
require('..').listen(
  port,
  // eslint-disable-next-line no-console
  () => console.log(`Dashboard carousel listening on http://localhost:${port}`),
);
