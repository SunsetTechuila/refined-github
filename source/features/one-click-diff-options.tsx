import React from 'dom-chef';
import {elementExists} from 'select-dom';
import {$, $optional} from 'select-dom/strict.js';
import * as pageDetect from 'github-url-detection';
import DotFillIcon from 'octicons-plain-react/DotFill';
import DotIcon from 'octicons-plain-react/Dot';
import DiffModifiedIcon from 'octicons-plain-react/DiffModified';
import BookIcon from 'octicons-plain-react/Book';
import DiffIcon from 'octicons-plain-react/Diff';

import features from '../feature-manager.js';
import observe from '../helpers/selector-observer.js';
import {removeTextNodeContaining} from '../helpers/dom-utils.js';

function isReactView(): boolean {
	return !elementExists('#feature_name[value="prx_files"]');
}

function parseViewSettings(): {hideWhitespace: boolean; splitPreference: string} {
	const {textContent} = $('script[data-target="react-app.embeddedData"]');
	const {viewSettings} = JSON.parse(textContent).payload.pullRequestsChangesRoute.user;
	return viewSettings;
}

function isHidingWhitespace(): boolean {
	if (new URL(location.href).searchParams.get('w') === '1') {
		return true;
	}

	if (isReactView()) {
		const {hideWhitespace} = parseViewSettings();
		return hideWhitespace;
	}

	// The selector is the native button
	return elementExists('button[name="w"][value="0"]:not([hidden])');
}

function isUnifiedDiff(): boolean {
	if (new URL(location.href).searchParams.get('diff') === 'unified') {
		return true;
	}

	if (isReactView()) {
		const {splitPreference} = parseViewSettings();
		return splitPreference === 'unified';
	}

	const diffSettingsForm = $('form[action$="/diffview"]');
	return new FormData(diffSettingsForm).get('diff') === 'unified';
}

function createWhitespaceButton(): HTMLElement {
	const url = new URL(location.href);
	const isWhitespaceHidden = isHidingWhitespace();

	if (isWhitespaceHidden) {
		url.searchParams.set('w', '0');
	} else {
		url.searchParams.set('w', '1');
	}

	return (
		<a
			href={url.href}
			data-hotkey="d w"
			className="tooltipped tooltipped-s ml-2 btn-link Link--muted px-2"
			aria-label={`${isWhitespaceHidden ? 'Show' : 'Hide'} whitespace changes`}
		>
			{isWhitespaceHidden ? <DotFillIcon className="v-align-middle" /> : <DotIcon className="v-align-middle"/>}
		</a>
	);
}

function createDiffTypeButton(): HTMLElement {
	const url = new URL(location.href);
	const isUnified = isUnifiedDiff();

	if (isUnified) {
		url.searchParams.set('diff', 'split');
	} else {
		url.searchParams.set('diff', 'unified');
	}

	return (
		<a
			href={url.href}
			className="tooltipped tooltipped-s ml-2 btn-link Link--muted px-2"
			aria-label={`Switch to the ${isUnified ? 'split' : 'unified'} diff view`}
		>
			{isUnified ? <BookIcon className="v-align-middle" /> : <DiffIcon className="v-align-middle"/>}
		</a>
	);
}

function attachPRButtons(dropdown: HTMLDetailsElement): void {
	const diffSettingsForm = $('form[action$="/diffview"]', dropdown);

	diffSettingsForm.append(createDiffTypeButton());
	diffSettingsForm.append(createWhitespaceButton());

	dropdown.replaceWith(diffSettingsForm);

	if (!isReactView()) {
		// Trim title
		const prTitle = $optional('.pr-toolbar .js-issue-title');
		if (prTitle && elementExists('.pr-toolbar progress-bar')) { // Only review view has progress-bar
			prTitle.style.maxWidth = '24em';
			prTitle.title = prTitle.textContent;
		}

		// Make space for the new button #655
		removeTextNodeContaining(
			$('[data-hotkey="c"] strong').previousSibling!,
			'Changes from',
		);

		// Remove extraneous padding around "Clear filters" button
		$optional('.subset-files-tab')?.classList.replace('px-sm-3', 'ml-sm-2');
	}
}

function initPR(signal: AbortSignal): void {
	observe('section[class*="PullRequestFilesToolbar"] button:has(> .octicon-gear)', {signal});
	// There are two "diff settings" element, one for mobile and one for the desktop. We only replace the one for the desktop
	observe('.hide-sm.hide-md details.diffbar-item:has(svg.octicon-gear)', attachPRButtons, {signal});
}

function attachButtons(nativeDiffButtons: HTMLElement): void {
	const anchor = nativeDiffButtons.parentElement!;

	// `usesFloats` is necessary to ensure the order and spacing as seen in #5958
	const usesFloats = anchor?.classList.contains('float-right');
	if (usesFloats) {
		anchor.after(
			<div className="float-right mr-3">
				{createWhitespaceButton()}
			</div>,
		);
	} else {
		anchor.before(createWhitespaceButton());
	}
}

function init(signal: AbortSignal): void {
	observe('[action="/users/diffview"]', attachButtons, {signal});
}

const shortcuts = {
	'd w': 'Show/hide whitespaces in diffs',
};

void features.add(import.meta.url, {
	shortcuts,
	include: [
		pageDetect.isPRFiles,
	],
	exclude: [
		pageDetect.isPRFile404,
	],
	init: initPR,
}, {
	shortcuts,
	include: [
		pageDetect.isCompare,
	],
	init,
});

/*
# Test URLs

- PR files: https://github.com/refined-github/refined-github/pull/6261/files
- Compare, in "Files changed" tab: https://github.com/rancher/rancher/compare/v2.6.3...v2.6.6
- Compare, without tab: https://github.com/rancher/rancher/compare/v2.6.5...v2.6.6
- Single commit: https://github.com/rancher/rancher/commit/e82921075436c21120145927d5a66037661fcf4e

*/
