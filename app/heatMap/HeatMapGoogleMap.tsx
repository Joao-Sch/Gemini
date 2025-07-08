import { GoogleMap, HeatmapLayer, useJsApiLoader } from "@react-google-maps/api";

type HeatMapGoogleMapProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  containerStyle: any;
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeId: string;
  handleMapLoad: () => void;
  showHeatmap: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  heatmapDataPoints: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gradients: any[];
  gradientIdx: number;
  radius: number | undefined;
  opacity: number | undefined;
  apiKey: string;
};

export function HeatMapGoogleMap({
  containerStyle,
  center,
  zoom,
  mapTypeId,
  handleMapLoad,
  showHeatmap,
  heatmapDataPoints,
  gradients,
  gradientIdx,
  radius,
  opacity,
  apiKey,
}: HeatMapGoogleMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: ["visualization"],
  });

  if (!isLoaded) return <div>Carregando mapa...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom}
      mapTypeId={mapTypeId}
      onLoad={handleMapLoad}
      options={{
        disableDefaultUI: true,
        zoomControl: false,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
      }}
    >
      {showHeatmap && heatmapDataPoints.length > 0 && (
        <HeatmapLayer
          data={heatmapDataPoints}
          options={{
            gradient: gradients[gradientIdx] || undefined,
            radius,
            opacity,
          }}
        />
      )}
    </GoogleMap>
  );
}