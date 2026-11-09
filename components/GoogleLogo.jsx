// components/GoogleLogo.jsx
import React from "react";
import Svg, { Path } from "react-native-svg";

export default function GoogleLogo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Red */}
      <Path
        d="M 2.47 6.50 A 11 11 0 0 1 19.78 4.22 L 16.38 7.62 A 6.2 6.2 0 0 0 6.63 8.90 Z"
        fill="#EA4335"
      />
      {/* Yellow */}
      <Path
        d="M 2.47 17.50 A 11 11 0 0 1 2.55 6.37 L 6.67 8.83 A 6.2 6.2 0 0 0 6.63 15.10 Z"
        fill="#FBBC05"
      />
      {/* Green */}
      <Path
        d="M 20.67 18.77 A 11 11 0 0 1 2.40 17.37 L 6.59 15.02 A 6.2 6.2 0 0 0 16.89 15.82 Z"
        fill="#34A853"
      />
      {/* Blue */}
      <Path
        d="M 12 9.9 L 22.80 9.9 A 11 11 0 0 1 20.57 18.89 L 16.83 15.88 A 6.2 6.2 0 0 0 17.83 14.1 L 12 14.1 Z"
        fill="#4285F4"
      />
    </Svg>
  );
}