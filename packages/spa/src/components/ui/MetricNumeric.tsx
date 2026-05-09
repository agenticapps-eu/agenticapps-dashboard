/**
 * MetricNumeric — big numeral with tabular-nums (Phase 5.1 Wave 0).
 *
 * UI-SPEC §3 + §8: text-3xl + font-semibold + tabular-nums for key metric display.
 * Optional suffix (e.g. "%") renders as slightly smaller text. Optional label
 * renders below in tertiary color.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'

export interface MetricNumericProps {
  value: number | string
  /** Optional unit suffix rendered immediately after the value (e.g. "%", "ms"). */
  suffix?: string
  /** Optional caption below the metric. */
  label?: string
}

export function MetricNumeric({ value, suffix, label }: MetricNumericProps): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-3xl font-semibold tabular-nums text-text-primary leading-tight">
        {value}
        {suffix ? (
          <span className="ml-1 text-xl text-text-secondary">{suffix}</span>
        ) : null}
      </span>
      {label ? (
        <span className="mt-1 text-sm text-text-tertiary">{label}</span>
      ) : null}
    </div>
  )
}
