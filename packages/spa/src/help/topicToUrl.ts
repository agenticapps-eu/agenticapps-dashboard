/**
 * topicToUrl — pure function mapping dot-separated topic paths to /help/* URLs.
 *
 * Plan 07-02 Task 1 — extracted from HelpHook.tsx so it can be tested without
 * rendering. Only the first `#` splits the anchor; dots inside the anchor are
 * preserved (e.g. "a.b#anchor.with.dots" → "/help/a/b#anchor.with.dots").
 *
 * @example
 *   topicToUrl('workflow.gates') === '/help/workflow/gates'
 *   topicToUrl('observability.scan#high-confidence') === '/help/observability/scan#high-confidence'
 */
export function topicToUrl(topic: string): string {
  const hashIdx = topic.indexOf('#')
  const path = hashIdx === -1 ? topic : topic.slice(0, hashIdx)
  const anchor = hashIdx === -1 ? '' : topic.slice(hashIdx + 1)
  const segments = path.split('.')
  const url = `/help/${segments.join('/')}`
  return anchor ? `${url}#${anchor}` : url
}
