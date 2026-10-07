import { LocalizedText } from '@/i18n/runtime'
import { mergeCancellationInfo } from '@/lib/conflicts'

function MergeCancellationSummary({ conflict, conflicts = [], className = '' }) {
  const info = mergeCancellationInfo(conflict, conflicts)
  if (!info) return null

  return (
    <span data-merge-cancellation-summary className={`block min-w-0 text-[11px] leading-4 text-slate-400 ${className}`}>
      <span>
        <LocalizedText text={info.date
          ? `The change merged on ${info.date} will be canceled and return to its previous value.`
          : 'The merged change will be canceled and return to its previous value.'} />
      </span>
      {info.changes.length > 0 && (
        <span className="ml-2 inline-flex min-w-0 flex-wrap gap-x-2">
          {info.changes.map((change) => (
            <span key={change.label} className="min-w-0">
              <LocalizedText text={change.label} />: <span translate="no" className="font-mono text-slate-300">{change.from} → {change.to}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

export default MergeCancellationSummary
