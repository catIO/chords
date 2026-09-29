import { createSvgIcon } from '@mui/material/utils'

/**
 * ChordLogoIcon - Built strictly according to Google Material Design Icon Guidelines:
 * - 24 x 24 dp coordinate grid with 20 x 20 dp live area (2 dp perimeter padding)
 * - Standard 2 dp stroke weight on all strings
 * - 6 dp vertical grid rhythm (y = 6, 12, 18)
 * - Integer keyline alignment (x = 3 to 21, centered at x = 12)
 * - Single uniform currentColor without artificial opacity layers
 * - Three noteheads stacked vertically in a chord with no stems
 */
export const ChordLogoIcon = createSvgIcon(
  <>
    {/* Three 2dp strings aligned to the 24dp Material grid */}
    <line
      x1="3"
      y1="6"
      x2="21"
      y2="6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="3"
      y1="12"
      x2="21"
      y2="12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      x1="3"
      y1="18"
      x2="21"
      y2="18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Three stacked chord noteheads without stems (centered at x=12) */}
    <ellipse
      cx="12"
      cy="6"
      rx="3.75"
      ry="2.25"
      transform="rotate(-20 12 6)"
      fill="currentColor"
    />
    <ellipse
      cx="12"
      cy="12"
      rx="3.75"
      ry="2.25"
      transform="rotate(-20 12 12)"
      fill="currentColor"
    />
    <ellipse
      cx="12"
      cy="18"
      rx="3.75"
      ry="2.25"
      transform="rotate(-20 12 18)"
      fill="currentColor"
    />
  </>,
  'ChordLogo'
)
