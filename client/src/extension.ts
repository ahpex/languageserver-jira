import * as path from "path";
import { workspace, ExtensionContext } from "vscode";

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    const config = workspace.getConfiguration("languageserver-jira");

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for all documents by default
        documentSelector: [{ scheme: "file", language: "*" }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
        },
        initializationOptions: {
            hostname: config.get<string>("hostname"),
            authorizationToken: config.get<string>("authorizationToken"),
            project: config.get<string>("project"),
            sslCertificateCheck: config.get<boolean>("sslCertificateCheck"),
        },
    };

    // Create the language client and start the client.
    client = new LanguageClient("languageserver-jira", "languageserver-jira", serverOptions, clientOptions);

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
