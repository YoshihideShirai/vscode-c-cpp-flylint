import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as vscode from 'vscode';
import { FlylintSettings, IConfigurations, propertiesPlatform } from '../../server/src/settings';
import { RobustPromises } from '../../server/src/utils';

// ------------------------------  Critical  -------------------------------
// One CANNOT test across IPC channels to the server, as the test is NOT the
// same Node.js process!
// ------------------------------  Critical  -------------------------------

// ------------------------------  Critical  -------------------------------
// VSCode's idea of settings are not ment for run-time calculated settings,
// as if it were used in this manner, these values would be persisted to
// the actual settings store.
// ------------------------------  Critical  -------------------------------

const currentDir = __dirname;

jest.setTimeout(300000);

describe('c_cpp_properties.json unit-tests', () => {
    test('should find the fixture file', () => {
        let propertiesData: IConfigurations = JSON.parse(readFileSync(resolve(currentDir, './fixtures/c_cpp_properties.json'), 'utf8'));

        const config = propertiesData.configurations.find(el => el.name === propertiesPlatform());

        expect(config).toBeDefined();
        expect(config).toHaveProperty('includePath');
    });

    describe('GIVEN an opened workspace', () => {
        const workspaceFolder = resolve(currentDir, './fixtures/c_cpp_properties');
        const filePath = resolve(workspaceFolder, 'c_cpp_properties.c');

        let document: vscode.TextDocument;

        beforeEach(async () => {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFolder));

            document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));

            await vscode.window.showTextDocument(document);
        });

        afterEach(async () => {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });

        async function getDocumentSettings(document: vscode.TextDocument): Promise<FlylintSettings> {
            return (await RobustPromises.retry(42, // # of attempts
                1000, // delay between retries
                1000, // timeout for a try
                () => vscode.commands.executeCommand('c-cpp-flylint.getLocalConfig', document))) as FlylintSettings;
        }

        test('it should handle non-existing includePaths setting', async () => {
            // WHEN
            let config: FlylintSettings = await getDocumentSettings(document);

            // THEN: simple checks against the set of includePaths
            expect(config).toBeDefined();
            expect(config.includePaths.length).toBeGreaterThan(2);

            // and then: a known set of directories are in the set of all includePaths
            expect(config.includePaths).not.toEqual(
                expect.arrayContaining(
                    [
                        expect.stringMatching(/\/usr\/lib\/gcc\/x86_64-linux-gnu\/5\/include/),
                        expect.stringMatching(/\$\{workspaceRoot}/),
                        expect.stringMatching(/^$/)
                    ]
                )
            );
        });

        test('it should handle plain includePaths setting', async () => {
            // WHEN
            let config: FlylintSettings = await getDocumentSettings(document);

            // THEN: simple checks against the set of includePaths
            expect(config).toBeDefined();
            expect(config.includePaths.length).toBeGreaterThan(2);

            // and then: a known set of directories are in the set of all includePaths
            expect(config.includePaths).toEqual(
                expect.arrayContaining(
                    [
                        expect.stringMatching(/a$/),
                        expect.stringMatching(/\/usr\/include$/)
                    ]
                )
            );
        });

        test('it should handle glob expansion of includePaths setting', async () => {
            // WHEN
            let config: FlylintSettings = await getDocumentSettings(document);

            // THEN: simple checks against the set of includePaths
            expect(config).toBeDefined();
            expect(config.includePaths.length).toBeGreaterThan(2);

            // and then: no glob sequences are in the set of all includePaths
            expect(config.includePaths).not.toEqual(
                expect.arrayContaining(
                    [
                        expect.stringMatching(/\/\*\*/),
                    ]
                )
            );

            // and then: a known set of directories are in the set of all includePaths
            expect(config.includePaths).toEqual(
                expect.arrayContaining(
                    [
                        expect.stringMatching(/\/a\/aa$/),
                        expect.stringMatching(/\/b\/aa$/),
                        expect.stringMatching(/\/c\/aa$/),
                        expect.stringMatching(/\/c\/bb$/)
                    ]
                )
            );
        });
    });
});
