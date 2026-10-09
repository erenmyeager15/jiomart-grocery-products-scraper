export type FetchMode = 'direct' | 'proxy';

/** Try the zero-transfer path first, then use the user's configured proxy as a bounded fallback. */
export function buildFetchModes(proxyEnabled: boolean): FetchMode[] {
    return proxyEnabled ? ['direct', 'proxy', 'proxy'] : ['direct', 'direct', 'direct'];
}

export type CompletionKind = 'saved' | 'valid-empty' | 'failed';

/** A verified source response with no rows after matching/filtering is not an infrastructure failure. */
export function classifyCompletion(input: {
    savedCount: number;
    spendingLimitReached: boolean;
    sourceValidQueryCount: number;
}): CompletionKind {
    if (input.savedCount > 0 || input.spendingLimitReached) return 'saved';
    if (input.sourceValidQueryCount > 0) return 'valid-empty';
    return 'failed';
}
