// A speech bubble (rounded corners, tail at the bottom left) with a filled four-point star inside at the upper
// right — the AI Chat button's icon. Outline in `currentColor`, like lucide's; only the star is filled.
export default function ChatSparkIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M15 6.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" fill="currentColor" strokeWidth="1" />
    </svg>
  )
}
