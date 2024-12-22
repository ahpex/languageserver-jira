import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    InitializeResult,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
} from "vscode-languageserver/node";

import { Range, TextDocument } from "vscode-languageserver-textdocument";
import axios, { AxiosResponse } from "axios";

let baseUrl: string;
let authorizationToken: string;
let project: string;
let sslCertificateCheck: boolean;

type SearchResult = {
    issues: Issue[];
};

type Issue = {
    key: string;
    fields: {
        summary: string;
        description: string;
        updated: string;
        creator: {
            displayName: string;
        };
        priority: {
            name: string;
        };
    };
};
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hostname: string;

connection.onInitialize((params: InitializeParams) => {
    const { initializationOptions } = params;
    baseUrl = `${initializationOptions.hostname}/rest/api/v2`;
    hostname = baseUrl;
    authorizationToken = initializationOptions.authorizationToken;
    project = initializationOptions.project;
    sslCertificateCheck = initializationOptions.sslCertificateCheck;

    if (!sslCertificateCheck) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
            },
        },
    };

    return result;
});

connection.onCompletion(async (textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    const position = textDocumentPosition.position;
    const range: Range = {
        start: { line: position.line, character: position.character - project.length },
        end: position,
    };

    const text = document?.getText(range);
    if (text && text === project) {
        try {
            const response: AxiosResponse<SearchResult, any> = await axios.get(`${baseUrl}/search`, {
                headers: { Authorization: `Bearer ${authorizationToken}` },
            });
            const completions: CompletionItem[] = toCompletionItems(response.data, textDocumentPosition.textDocument.uri, range);
            return completions;
        } catch (error) {
            console.error("Error fetching completions:", error);
            return [];
        }
    }

    return [];
});

function toCompletionItems(data: SearchResult, uri: string, range: Range): CompletionItem[] {
    return data.issues.map((item) => {
        let newText = `${item.key} ${item.fields.summary}`;
        if (uri.endsWith(".md")) {
            newText = `[${item.key} ${item.fields.summary}](https://${hostname}/browse/${item.key})`;
        }

        return {
            label: `${item.key} ${item.fields.summary}`,
            textEdit: TextEdit.replace(range, newText),
            kind: CompletionItemKind.Text,
            data: item.key,
        };
    });
}

// Register a handler for the 'completionItem/resolve' request.
connection.onCompletionResolve(async (item: CompletionItem): Promise<CompletionItem> => {
    const key = item.data;

    try {
        const response = await axios.get(`${baseUrl}/issue/${key}`, {
            headers: { Authorization: `Bearer ${authorizationToken}` },
        });
        const issue: Issue = response.data;
        item.documentation = {
            kind: "markdown",
            value: `### ${issue.key} ${issue.fields.summary}\n[View in Jira](https://${hostname}/browse/${issue.key})\n- Creator: ${issue.fields.creator.displayName}\n- Priority: ${issue.fields.priority.name}`,
        };
    } catch (error) {
        console.error("Error fetching completions:", error);
        return item;
    }

    return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
