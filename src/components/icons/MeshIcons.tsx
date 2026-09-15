import React from 'react';
import Svg, { Path, Rect, Circle, Line, Polyline, Polygon } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Single-weight stroke-based SVG vector icon library.
 * Designed for cross-device consistency (Pixel, Samsung, Xiaomi)
 * High legibility under direct sunlight and in 100% grayscale.
 */

// ── AUTHENTIC NÜRNBERG & BAVARIAN CIVIC ICONS ──

// 1. Official Nuremberg City Crest (Kleines Nürnberger Wappen)
// Split shield: Left half Imperial Eagle (Reichsadler), Right half 5 diagonal Franconian bends
export const NurnbergCrestIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Shield Escutcheon */}
    <Path
      d="M12 2C7 2 3 5 3 11c0 6.5 9 11 9 11s9-4.5 9-11c0-6-4-9-9-9z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Vertical Division (Gespaltener Schild) */}
    <Line x1="12" y1="2" x2="12" y2="22" stroke={color} strokeWidth={strokeWidth} />
    {/* Left Dexter: Imperial Eagle (Reichsadler) */}
    <Path
      d="M12 5.5c-1.2 0-2.2.4-2.7 1.3l-1.3-.2c.5 1 1.2 1.4 2 1.4h2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Eagle Wing Feathers */}
    <Path
      d="M12 8.5c-2.5 0-4.8 1.2-6.5 2.8 1.8.3 3.8-.2 4.5-.8M12 11.2c-2.2 0-4.2 1-5.5 2.4 1.5.2 3.2-.2 3.8-.6M12 13.8c-1.8 0-3.3.8-4.2 2 1.2.2 2.5-.1 3-.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Eagle Talon */}
    <Path
      d="M10 18l-2 1.5M9 16.5l-1.2 3M10.5 18.5l-1 2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    {/* Right Sinister: 5 Diagonal Bends (Nürnberger Schrägbalken) */}
    <Line x1="12" y1="4.5" x2="18.5" y2="11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="8" x2="19.8" y2="15.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="11.5" x2="18.5" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="15" x2="16.5" y2="19.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="14" y1="2.8" x2="19.5" y2="8.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// 2. Franconian Rake (Fränkischer Rechen - Bavarian Franconia)
// Official heraldic shield with the 3 silver/white points on red
export const FrankenRechenIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Shield Escutcheon */}
    <Path
      d="M12 2C7 2 3 5 3 11c0 6.5 9 11 9 11s9-4.5 9-11c0-6-4-9-9-9z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Three Franconian Peaks (Drei Spitzen) */}
    <Path
      d="M3 11l3-4.5L9 11l3-4.5 3 4.5 3-4.5 3 4.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Vertical Rake Ribs */}
    <Line x1="6" y1="11" x2="6" y2="16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="11" x2="12" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="18" y1="11" x2="18" y2="16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// 3. Nuremberg Kaiserburg Fortress & Sinwellturm Keep
export const CrestCastleIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Spire Weather Vane */}
    <Line x1="12" y1="1" x2="12" y2="3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Sinwellturm Conical Roof */}
    <Path d="M12 3l-3.5 5h7L12 3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    {/* Timber Defense Gallery / Hoarding */}
    <Rect x="8" y="8" width="8" height="2" rx="0.5" stroke={color} strokeWidth={strokeWidth} />
    {/* Round Tower Keep (Sinwellturm) */}
    <Path d="M9 10v11h6V10" stroke={color} strokeWidth={strokeWidth} />
    {/* Arrow Slits */}
    <Line x1="12" y1="12" x2="12" y2="14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="16" x2="12" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Fortress Curtain Wall & Crenellations */}
    <Path
      d="M3 21v-4h2v2h2v-2h2v5M15 21v-4h2v2h2v-2h2v5M2 21h20"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export const KaiserburgIcon = CrestCastleIcon;

// 4. Nuremberg "Schöner Brunnen" Gothic Spire Fountain (Notwasser & Brunnen)
export const SchoenerBrunnenIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Top Finial & Cruciform */}
    <Line x1="12" y1="1" x2="12" y2="3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="10.5" y1="2" x2="13.5" y2="2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Gothic Spire Pinnacles (Tier 1) */}
    <Path d="M12 3.5L10 8h4L12 3.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    {/* Middle Canopy with Gothic Trefoil (Tier 2) */}
    <Path d="M8.5 8h7v5h-7z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Path d="M9.5 13c0-1.8 1.1-2.5 2.5-2.5s2.5.7 2.5 2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Famous Golden Ring (Messingring) */}
    <Circle cx="12" cy="15.5" r="1.5" stroke={color} strokeWidth={strokeWidth} />
    {/* Lower Spout Tier */}
    <Path d="M6.5 13h11v4h-11z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    {/* Stone Basin & Base (Hauptmarkt) */}
    <Path
      d="M3 21h18M4 17h16v4H4z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// 5. German Katastrophenschutz E57 Roof Siren (Einheitssirene Zivilschutz)
export const KatsSireneIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Conical Protective Cap (Pilzkopf) */}
    <Path d="M12 3L3 9h18L12 3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    {/* Sound Louvers & Rotor Housing */}
    <Path d="M6 9v4.5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5V9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="7" y1="11.5" x2="17" y2="11.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="8" y1="13.5" x2="16" y2="13.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Siren Mast & Mount */}
    <Line x1="12" y1="16" x2="12" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="8" y1="21" x2="16" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="18" x2="9" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="18" x2="15" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Acoustic Siren Waves */}
    <Path d="M2.5 7.5a6 6 0 0 0 0 6M21.5 7.5a6 6 0 0 1 0 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// 6. Nuremberg Fortified Gate Tower & Portcullis (Spittlertor / Frauentor Schutzraum)
export const NurnbergStadttorIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Conical Steep Roof */}
    <Path d="M6 6l6-4 6 4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Line x1="12" y1="1" x2="12" y2="2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Crenellations & Tower Body */}
    <Path d="M5 6h14v15H5V6z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Line x1="8" y1="6" x2="8" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="6" x2="12" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="16" y1="6" x2="16" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Arched Stone Portal */}
    <Path d="M9 21v-5c0-1.7 1.3-3 3-3s3 1.3 3 3v5" stroke={color} strokeWidth={strokeWidth} />
    {/* Raised Heavy Iron Portcullis (Fallgatter) */}
    <Line x1="9" y1="16" x2="15" y2="16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="11" y1="13.5" x2="11" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="13" y1="13.5" x2="13" y2="21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// 7. German THW / Katastrophenschutz Heavy Rescue (Bergung & Trümmer)
export const ThwRescueIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Crossed Rescue Pick and Heavy Crowbar */}
    <Line x1="4" y1="20" x2="20" y2="4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="20" y1="20" x2="4" y2="4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    {/* Pick Head & Chisel Ends */}
    <Path d="M17 3l4 4M3 7l4-4M3 17l4 4M17 21l4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    {/* Center Reinforcement Ring */}
    <Circle cx="12" cy="12" r="3.5" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="12" cy="12" r="1" stroke={color} strokeWidth={strokeWidth} fill={color} />
  </Svg>
);

// 8. Bavarian Tactical Lozenge Diamond Mesh (Bayerische Rauten)
export const BavarianLozengeIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 1.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* 4 Interlocking Tactical Diamond Lozenges */}
    <Polygon points="12 2 17 7 12 12 7 7" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Polygon points="17 7 22 12 17 17 12 12" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Polygon points="12 12 17 17 12 22 7 17" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Polygon points="7 7 12 12 7 17 2 12" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <Circle cx="12" cy="12" r="1.5" stroke={color} strokeWidth={strokeWidth} fill={color} />
  </Svg>
);

// Antenna / Radio Mast (Radar Tab)
export const RadioTowerIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4.93 4.93a10 10 0 0 1 14.14 0M7.76 7.76a6 6 0 0 1 8.48 0M12 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 12v9M9 21h6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Alert Triangle / Beacon (SOS Tab)
export const AlertTriangleIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Shield with Checkmark (Familie Tab)
export const ShieldCheckIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Polyline
      points="9 12 11 14 15 10"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Map Pin (Orte Tab)
export const MapPinIcon: React.FC<IconProps> = ({ size = 24, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

// Help Circle (Anleitung Button)
export const HelpCircleIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Menu Lines (Tactical Drawer Button)
export const MenuLinesIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="3" y1="18" x2="21" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Checkmark Circle (Verified / Safe redundancy)
export const CheckCircleIcon: React.FC<IconProps> = ({ size = 18, color = '#00e676', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} />
    <Polyline points="8 12 11 15 16 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Alert Octagon / Hazard
export const AlertOctagonIcon: React.FC<IconProps> = ({ size = 18, color = '#d90429', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polygon
      points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="12" y1="16" x2="12.01" y2="16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Chevron Down & Up (For Collapsible Disclosure)
export const ChevronDownIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polyline points="6 9 12 15 18 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Polyline points="18 15 12 9 6 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Close X Icon
export const CloseIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Flame (Fire Emergency)
export const FlameIcon: React.FC<IconProps> = ({ size = 22, color = '#ff6b35', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Water / Supplies
export const WaterDropIcon: React.FC<IconProps> = ({ size = 22, color = '#38bdf8', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Trapped / Rubble Structure
export const RubbleIcon: React.FC<IconProps> = ({ size = 22, color = '#ffb703', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 21h18M5 21l3-10 4 6 4-8 3 12M9 17h6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Waves / Flood Hazard
export const WaveIcon: React.FC<IconProps> = ({ size = 20, color = '#38bdf8', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Road Block / Traffic Hazard
export const RoadBlockIcon: React.FC<IconProps> = ({ size = 20, color = '#d90429', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

// Medical Emergency Cross (Sanität / Hospital)
export const MedicalCrossIcon: React.FC<IconProps> = ({ size = 22, color = '#d90429', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 3H15V9H21V15H15V21H9V15H3V9H9V3Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Telephone / Hotline
export const PhoneIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Settings Gear / Maintenance
export const SettingsIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Search Magnifying Glass
export const SearchIcon: React.FC<IconProps> = ({ size = 18, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Lightbulb / Practical Advice
export const LightbulbIcon: React.FC<IconProps> = ({ size = 20, color = '#ffb703', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// DTN Carrier Truck / Data Mule
export const TruckIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="1" y="3" width="15" height="13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Polygon points="16 8 20 8 23 11 23 16 16 16 16 8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="5.5" cy="18.5" r="2.5" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="18.5" cy="18.5" r="2.5" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

// Cryptographic Padlock (Encryption Verification)
export const LockIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="12" cy="16" r="1.5" stroke={color} strokeWidth={strokeWidth} fill={color} />
  </Svg>
);

// RF Signal Waves / Broadcast Bars
export const SignalBarsIcon: React.FC<IconProps> = ({ size = 20, color = '#ffffff', strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="4" y1="19" x2="4" y2="15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="9" y1="19" x2="9" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="14" y1="19" x2="14" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="19" y1="19" x2="19" y2="4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

