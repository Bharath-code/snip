const { extractVariables, hasVariables, interpolate } = require('../lib/template');

describe('template engine', () => {
    test('extractVariables parses simple variables', () => {
        const vars = extractVariables('echo {{name}} and {{greeting}}');
        expect(vars).toHaveLength(2);
        expect(vars[0].name).toBe('name');
        expect(vars[0].defaultValue).toBeNull();
        expect(vars[1].name).toBe('greeting');
    });

    test('extractVariables parses variables with defaults', () => {
        const vars = extractVariables('docker run {{image:ubuntu:24.04}} {{cmd:bash}}');
        expect(vars).toHaveLength(2);
        expect(vars[0].name).toBe('image');
        expect(vars[0].defaultValue).toBe('ubuntu:24.04');
        expect(vars[1].name).toBe('cmd');
        expect(vars[1].defaultValue).toBe('bash');
    });

    test('extractVariables deduplicates by name', () => {
        const vars = extractVariables('{{x}} and {{x}} and {{y}}');
        expect(vars).toHaveLength(2);
        expect(vars.map(v => v.name)).toEqual(['x', 'y']);
    });

    test('extractVariables resolves $ENV defaults', () => {
        process.env.__SNIP_TEST_VAR = 'from-env';
        const vars = extractVariables('{{val:$__SNIP_TEST_VAR}}');
        expect(vars[0].defaultValue).toBe('from-env');
        delete process.env.__SNIP_TEST_VAR;
    });

    test('hasVariables returns true when template vars exist', () => {
        expect(hasVariables('echo {{name}}')).toBe(true);
        expect(hasVariables('echo hello')).toBe(false);
        expect(hasVariables('')).toBe(false);
        expect(hasVariables(null)).toBe(false);
    });

    test('interpolate replaces variables with values', () => {
        const result = interpolate('Hello {{name}}, welcome to {{place}}', {
            name: 'World',
            place: 'Earth'
        });
        expect(result).toBe('Hello World, welcome to Earth');
    });

    test('interpolate uses defaults when values are empty', () => {
        const result = interpolate('{{lang:bash}} script', {});
        expect(result).toBe('bash script');
    });

    test('interpolate leaves unresolved vars as-is', () => {
        const result = interpolate('{{unknown}} var', {});
        expect(result).toBe('{{unknown}} var');
    });

    test('interpolate handles colons in defaults (e.g. docker image tags)', () => {
        const result = interpolate('docker run {{image:node:20-alpine}}', {});
        expect(result).toBe('docker run node:20-alpine');
    });
});
