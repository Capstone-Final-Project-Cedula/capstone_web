import React from 'react';

const SIZE_MAP = {
  sm: 24,
  md: 40,
  lg: 56,
};

/**
 * LoadingSpinner — same public API as before (`size` prop), now shaped
 * like the app logo: a document outline with a scanning fingerprint
 * and a pulsing upload arrow, instead of a generic spinner icon.
 */
const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const px = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 100 100"
        width={px}
        height={px}
        fill="none"
        aria-hidden="true"
      >
        {/* Document outline — static */}
        <path
          d="M36 18
             C24 18 24 30 24 30
             L24 78
             C24 82 27 84 30 84
             L64 84
             C67 84 70 82 70 78
             L70 30
             L58 18
             Z"
          stroke="var(--color-primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Folded corner */}
        <path
          d="M58 18 L58 28 C58 30 60 30 60 30 L70 30"
          stroke="var(--color-primary)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Fingerprint rings — rotate like a scan sweep */}
        <g
          style={{
            transformOrigin: '47px 46px',
            animation: 'lspin-scan 1.6s ease-in-out infinite',
          }}
        >
          <path
            d="M47 24
               C58 24 66 32 66 43
               L66 50"
            stroke="var(--color-voice)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M47 24
               C36 24 28 32 28 43
               L28 50"
            stroke="var(--color-voice)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
        </g>

        {/* Fingerprint core loop — static */}
        <rect
          x="37"
          y="33"
          width="20"
          height="26"
          rx="10"
          stroke="var(--color-primary)"
          strokeWidth="5"
        />

        {/* Upload arrow — pulses upward */}
        <g
          style={{
            transformOrigin: '52px 68px',
            animation: 'lspin-arrow 1.6s ease-in-out infinite',
          }}
        >
          <path
            d="M52 76 L52 60 M52 60 L46 66 M52 60 L58 66"
            stroke="var(--color-voice)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <span className="sr-only">Loading…</span>

      <style>{`
        @keyframes lspin-scan {
          0%   { transform: rotate(0deg); opacity: 1; }
          50%  { transform: rotate(180deg); opacity: 0.6; }
          100% { transform: rotate(360deg); opacity: 1; }
        }
        @keyframes lspin-arrow {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%      { transform: translateY(-4px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          span[role="status"] g {
            animation: none !important;
          }
        }
      `}</style>
    </span>
  );
};

export default LoadingSpinner;