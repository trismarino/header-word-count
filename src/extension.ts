import { window, Disposable, ExtensionContext, StatusBarAlignment, StatusBarItem } from 'vscode';
import * as vscode from 'vscode';

class WordCountLensProvider implements vscode.CodeLensProvider {
	private wordCounter: WordCounter;

	constructor(wordCounter: WordCounter) {
		this.wordCounter = wordCounter;
	}

	public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		let headerCounts = this.wordCounter.calculateHeaderCounts();

		let codeLenses: vscode.CodeLens[] = headerCounts.map((headerCount) => {
			let range: vscode.Range = new vscode.Range(headerCount.lineNumber, 0, headerCount.lineNumber, 0);
			let c: vscode.Command = {
				command: '',
				title: `Section word count: ${headerCount.wordCount} words`
			};
			return new vscode.CodeLens(range, c);
		});

		return codeLenses;
	}
}

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {

	let wordCounter = new WordCounter();
	let docSelector = {
		language: "markdown",
		scheme: "file",
	};

	// Add to a list of disposables which are disposed when this extension is deactivated.
	context.subscriptions.push(wordCounter);
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(
			docSelector, new WordCountLensProvider(wordCounter)));

}

class WordCounter {
	private headers: any[] = [];
	private headerCounts: any[] = [];
	private readonly NO_VALUE: number = -1;

	public calculateHeaderCounts() {
		// Get the current text editor 
		let editor = window.activeTextEditor;
		if (!editor) {
			return [];
		}

		let document = editor.document;

		// get lines and populate header data
		let documentLines: string[] = document.getText().split('\n');
		this.headers = this.getHeaders(documentLines);

		let filteredHeaders: any[] = this.headers.filter((header) => header.isHeader);

		// calculate word count for every section under header
		this.headerCounts = filteredHeaders.map((header) => {
			let selectionText: string = this.getSelectionText(header.lineNumber, documentLines);
			let wordCount: number = 0;
			if (selectionText !== "") {
				wordCount = this.getWordCount(selectionText);
			}

			let headerCount = {
				lineNumber: header.lineNumber,
				wordCount: wordCount,
			};
			return headerCount;
		});

		return this.headerCounts;
	}

	private getSelectionText(lineNumber: number, documentLines: string[]) {
		let lastHeaderLine: number = this.findPreviousHeaderLine(lineNumber);
		let nextHeaderLine: number = this.findNextHeaderLine(lastHeaderLine + 1, this.headers[lastHeaderLine].headerCount);

		// prepare text string by removing target info from the word count
		let sectionTextLines: string[] = documentLines.slice(lastHeaderLine, nextHeaderLine);
		let result: string = sectionTextLines.join(' ');

		return result;
	}

	private getHeaders(documentLines: string[]) {
		let headers: any[] = [];
		documentLines.forEach((line, index) => {
			let headerData = {
				lineNumber: index,
				isHeader: false,
				headerCount: 0,
			};

			// add header and count (level) data to the object
			headerData.isHeader = line.search(/^#+\s/) !== -1 ? true : false;
			if (headerData.isHeader) {
				let matches = line.match(/#/g);
				headerData.headerCount = matches !== null ? matches.length : 0;
			}

			headers.push(headerData);
		});

		return headers;
	}

	private findNextHeaderLine(currentLine: number, headerLevel: number) {
		let nextHeaderLine: number = currentLine;
		let nextHeaderFound: boolean = false;
		while (!nextHeaderFound && nextHeaderLine < this.headers.length) {
			if (this.headers[nextHeaderLine].isHeader && this.headers[nextHeaderLine].headerCount <= headerLevel) {
				nextHeaderFound = true;
			} else {
				nextHeaderLine++;
			}
		}
		return nextHeaderLine;
	}

	private findPreviousHeaderLine(currentLine: number) {
		let previousHeaderLine: number = this.NO_VALUE;
		while (currentLine >= 0 && previousHeaderLine < 0) {
			if (this.headers[currentLine].isHeader) {
				previousHeaderLine = currentLine;
			}
			currentLine--;
		}
		return previousHeaderLine;
	}

	private getWordCount(textString: string): number {

		// Parse out unwanted whitespace so the split is accurate 
		textString = textString.replace(/(< ([^>]+)<)/g, '').replace(/\s+/g, ' ');
		textString = textString.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

		let wordCount = 0;
		if (textString !== "") {
			wordCount = textString.split(" ").length;
		}

		return wordCount;
	}

	dispose() {}
}
