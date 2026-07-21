import { URI } from '../../../../base/common/uri.js';

export type EviDirectoryItem = {
	uri: URI;
	name: string;
	isSymbolicLink: boolean;
	children: EviDirectoryItem[] | null;
	isDirectory: boolean;
	isGitIgnoredDirectory: false | { numChildren: number }; // if directory is gitignored, we ignore children
}
