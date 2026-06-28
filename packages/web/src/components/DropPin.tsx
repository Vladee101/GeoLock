import L from 'leaflet';

const lockSVG = (color: string) => `
<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="14" width="20" height="18" rx="3" fill="${color}" stroke="white" stroke-width="1.5"/>
  <path d="M9 14V10a5 5 0 0 1 10 0v4" stroke="${color}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <circle cx="14" cy="23" r="2.5" fill="white"/>
</svg>`;

const unlockSVG = (color: string) => `
<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="14" width="20" height="18" rx="3" fill="${color}" stroke="white" stroke-width="1.5"/>
  <path d="M9 14V10a5 5 0 0 1 10 0" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <circle cx="14" cy="23" r="2.5" fill="white"/>
</svg>`;

export const lockedIcon = L.divIcon({
  html: lockSVG('#E24B4A'), className: '',
  iconSize: [28, 36], iconAnchor: [14, 36],
});

export const unlockedIcon = L.divIcon({
  html: unlockSVG('#1D9E75'), className: '',
  iconSize: [28, 36], iconAnchor: [14, 36],
});
