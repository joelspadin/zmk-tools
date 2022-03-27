import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { YAMLMap, YAMLSeq } from 'yaml/types';
import { ConfigLocation } from './config';
import { fetchResource } from './file';
import { decode } from './util';

export interface BuildItem {
    board: string;
    shield?: string;
}

export function buildItemEquals(a: BuildItem, b: BuildItem): boolean {
    return a.board === b.board && a.shield === b.shield;
}

/**
 * Appends the given builds to a config repo's build.yaml file.
 */
export async function addToBuildMatrix(
    context: vscode.ExtensionContext,
    config: ConfigLocation,
    builds: BuildItem[]
): Promise<void> {
    const matrix = await readMatrix(context, config);

    const currentItems = parseInclude(matrix);

    if (!matrix.has('include')) {
        matrix.set('include', new YAMLSeq());
    }

    const include = matrix.get('include') as YAMLSeq;

    for (const build of builds) {
        if (!currentItems.some((x) => buildItemEquals(x, build))) {
            include.add(build);
        }
    }

    await writeMatrix(config, matrix);
}

function getMatrixUri(config: ConfigLocation) {
    const settings = vscode.workspace.getConfiguration('zmk', config.workspace);
    const path = settings.get<string>('buildMatrixPath') || 'build.yaml';

    return vscode.Uri.joinPath(config.workspace.uri, path);
}

async function readMatrix(context: vscode.ExtensionContext, config: ConfigLocation): Promise<yaml.Document> {
    try {
        const uri = getMatrixUri(config);
        const file = decode(await vscode.workspace.fs.readFile(uri));

        return yaml.parseDocument(file);
    } catch (e) {
        if (e instanceof vscode.FileSystemError) {
            return await getEmptyMatrix(context);
        }

        throw e;
    }
}

/**
 * Parses the build matrix's "include" field as a list of build items.
 */
function parseInclude(matrix: yaml.Document): BuildItem[] {
    const include = matrix.get('include');

    if (!(include instanceof YAMLSeq)) {
        return [];
    }

    const items: BuildItem[] = [];
    for (const map of include.items) {
        if (!(map instanceof YAMLMap)) {
            continue;
        }

        const board = map.get('board');
        if (typeof board !== 'string') {
            continue;
        }

        const item: BuildItem = {
            board,
        };

        const shield = map.get('shield');
        if (typeof shield === 'string') {
            item.shield = shield;
        }

        items.push(item);
    }
    return items;
}

async function writeMatrix(config: ConfigLocation, matrix: yaml.Document) {
    const text = stringify(matrix);
    const file = new TextEncoder().encode(text);

    const uri = getMatrixUri(config);
    await vscode.workspace.fs.writeFile(uri, file);
}

/**
 * Calls yaml.stringify() but preserves comments before the document.
 */
function stringify(matrix: yaml.Document) {
    let text = yaml.stringify(matrix);

    if (matrix.commentBefore) {
        const comment = matrix.commentBefore
            .split('\n')
            .map((line) => '#' + line)
            .join('\n');
        text = comment + '\n---\n' + text;
    }

    return text;
}

async function getEmptyMatrix(context: vscode.ExtensionContext): Promise<yaml.Document> {
    const file = decode(await fetchResource(context, 'templates/build.yaml'));

    return yaml.parseDocument(file);
}
