// Declaration for the base Typr module (parse only; U lives in Typr.U.js).
import type TyprWithU from './Typr.U.js'

declare const Typr: Omit<typeof TyprWithU, 'U'>
export default Typr
