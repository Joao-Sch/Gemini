import { useState } from "react";

export const heatMapData = [
  { lat: -23.2645, lng: -47.2992 },
  { lat: -23.2630, lng: -47.2960 },
  { lat: -23.2960, lng: -47.2840 },
  { lat: -23.2900, lng: -47.2900 },
];

export const gradients = [
  null,
  [
    "rgba(0,0,0,0)",
    "rgba(18, 83, 45, 0.5)",
    "rgba(18, 83, 45, 1)",
    "rgba(23, 138, 70, 1)",
    "rgba(0, 77, 102, 1)",
    "rgba(0, 77, 102, 0.7)",
    "rgba(255,255,255,0.8)"
  ],
];

export function useHeatMapViewModel(
  pontos: { lat: number; lng: number }[]
) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [gradientIdx, setGradientIdx] = useState(0);
  const [radius, setRadius] = useState<number | undefined>(undefined);
  const [opacity, setOpacity] = useState<number | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [heatmapDataPoints, setHeatmapDataPoints] = useState<any[]>([]);

  function handleMapLoad() {
    if (window.google && window.google.maps) {
      setHeatmapDataPoints(
        pontos.map((p) => new window.google.maps.LatLng(p.lat, p.lng))
      );
    }
  }

  return {
    showHeatmap,
    setShowHeatmap,
    gradientIdx,
    setGradientIdx,
    radius,
    setRadius,
    opacity,
    setOpacity,
    heatmapDataPoints,
    handleMapLoad,
  };
}