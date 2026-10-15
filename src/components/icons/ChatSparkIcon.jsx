// The AI Chat button's icon: a speech bubble (rounded corners, tail at the bottom left) left open at its top
// right corner, where a four-point sparkle sits in the gap. Outline in `currentColor`, like lucide's; only the
// sparkle is filled.
export default function ChatSparkIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12.5 3.5H6a2.5 2.5 0 0 0-2.5 2.5v14.5l4-4H18a2.5 2.5 0 0 0 2.5-2.5V11" />
      <path d="M18 2c.35 2.15 1.1 2.9 3.5 3.5-2.4.6-3.15 1.35-3.5 3.5-.35-2.15-1.1-2.9-3.5-3.5 2.4-.6 3.15-1.35 3.5-3.5z" fill="currentColor" strokeWidth="1.25" />
    </svg>
  )
}
