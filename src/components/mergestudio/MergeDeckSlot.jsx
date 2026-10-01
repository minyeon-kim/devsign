import { createContext } from 'react'

// The navigator hosts the deck while its editing state stays in the studio.
export const MergeDeckSlotContext = createContext({ element: null, setElement: () => {} })
