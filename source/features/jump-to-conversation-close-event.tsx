import React from 'dom-chef';
import {elementExists, lastElement} from 'select-dom';
import {$} from 'select-dom/strict.js';
import * as pageDetect from 'github-url-detection';

import {wrap} from '../helpers/dom-utils.js';
import features from '../feature-manager.js';
import observe from '../helpers/selector-observer.js';

export const statusBadge = [
	'#partial-discussion-header .State',
	'[class^="StateLabel"]',
] as const;

export async function getLastCloseEvent(): Promise<HTMLElement | undefined> {
	if (elementExists('#issue-timeline > *:last-child [class="prc-Spinner-Box"]')) {
		return new Promise(resolve => {
			const observer = new MutationObserver(async ([{target}]) => {
				if (target instanceof Element && !elementExists('[class="prc-Spinner-Box"]', target)) {
					observer.disconnect();
					resolve(await getLastCloseEvent());
				}
			});
			observer.observe($('#issue-timeline > *:last-child'), {childList: true});
		});
	}

	return lastElement([
		// TODO: Move to selectors.ts
		// Old view
		`.TimelineItem-badge :is(
			.octicon-issue-closed,
			.octicon-git-merge,
			.octicon-git-pull-request-closed,
			.octicon-skip
		)`,
		// React view (values for PR states not yet known)
		`[data-testid="state-reason-link"]:is(
			[href*="reason%3Acompleted"],
			[href*="reason%3Anot-planned"]
		)`,
	])?.closest([
		'.TimelineItem', // Old view
		'[data-timeline-event-id]',
	])?.querySelector('relative-time') ?? undefined;
}

async function addToConversation(discussionHeader: HTMLElement): Promise<void> {
	// Avoid native `title` by disabling pointer events, we have our own `aria-label`. We can't drop the `title` attribute because some features depend on it.
	discussionHeader.style.pointerEvents = 'none';

	const lastCloseEvent = await getLastCloseEvent();
	if (!lastCloseEvent) {
		throw new Error('Could not find last close event');
	}

	wrap(
		discussionHeader,
		<a
			aria-label="Scroll to most recent close event"
			className="tooltipped tooltipped-e"
			href={lastCloseEvent.closest('a')!.href}
		/>,
	);
}

function init(signal: AbortSignal): void {
	observe(
		statusBadge,
		addToConversation,
		{signal},
	);
}

void features.add(import.meta.url, {
	asLongAs: [
		pageDetect.isConversation,
		pageDetect.isClosedConversation,
	],
	awaitDomReady: true, // We're specifically looking for the last event
	init,
});

/*
## Test URLs
Closed Issue: https://github.com/refined-github/sandbox/issues/2
Closed Issue (Not Planned): https://github.com/refined-github/sandbox/issues/24
Merged PR: https://github.com/refined-github/sandbox/pull/23
Closed PR: https://github.com/refined-github/sandbox/pull/22
*/
