/**
 * Isolate tests from user config and data: use temp XDG dirs per worker.
 * Must run before any test file loads so config/storage see these paths.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

const testRoot = path.join(os.tmpdir(), `snip-test-${process.pid}`);
const configHome = path.join(testRoot, 'config');
const dataHome = path.join(testRoot, 'data');

fs.mkdirSync(configHome, { recursive: true });
fs.mkdirSync(dataHome, { recursive: true });

process.env.XDG_CONFIG_HOME = configHome;
process.env.XDG_DATA_HOME = dataHome;
