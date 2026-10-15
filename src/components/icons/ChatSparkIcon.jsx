// The AI Chat button's icon: a speech bubble (rounded corners, tail at the bottom left, its body near square)
// left open at its top right corner, where a four-point sparkle sits in the gap with room round it. Outline in
// `currentColor`, like lucide's; only the sparkle is filled.
export default function ChatSparkIcon({ className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M11.5 4H5.5A2.5 2.5 0 0 0 3 6.5V21.5l3.5-3.5h10A2.5 2.5 0 0 0 19 15.5v-4" />
      <path d="M18.5 1.75c.3 1.95 1.05 2.7 3 3-1.95.3-2.7 1.05-3 3-.3-1.95-1.05-2.7-3-3 1.95-.3 2.7-1.05 3-3z" fill="currentColor" strokeWidth="1.25" />
    </svg>
  )
}
