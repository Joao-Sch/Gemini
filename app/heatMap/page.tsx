"use client";
import { useHeatMapViewModel, gradients } from "./useHeatMapViewModel";
import { HeatMapControls } from "./HeatMapControls";
import { HeatMapGoogleMap } from "./HeatMapGoogleMap";
import entregasJson from "../../lib/entregas.json";
import Image from "next/image"; // para usar a logo

const containerStyle = {
  width: "100%",
  height: "70vh",
};
const center = { lat: -23.2645, lng: -47.2992 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrairLatLngDeEntregas(jsonEntregas: any): { lat: number; lng: number }[] {
  const pontos: { lat: number; lng: number }[] = [];
  Object.values(jsonEntregas).forEach((entrega: any) => {
    if (Array.isArray(entrega.addresses)) {
      entrega.addresses.forEach((addr: any) => {
        if (typeof addr.lat === "number" && typeof addr.lng === "number") {
          pontos.push({ lat: addr.lat, lng: addr.lng });
        }
      });
    }
  });
  return pontos;
}

const pontosHeatmap = extrairLatLngDeEntregas(entregasJson);

export default function HeatMapPage() {
  const {
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
  } = useHeatMapViewModel(pontosHeatmap);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="flex flex-col w-full sm:max-w-2xl h-[80vh] sm:h-[90vh] bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header verde igual ao chatbot */}
        <div className="relative bg-green-600 text-white p-4 flex items-center justify-center">
          <h1 className="text-xl font-bold w-full text-center">Mapa de Calor</h1>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Image
              src="/logo_i9delivery.png"
              alt="logo"
              width={40}
              height={40}
              className="rounded"
            />
          </div>
        </div>
        {/* Controles */}
        <div className="p-4">
          <HeatMapControls
            showHeatmap={showHeatmap}
            setShowHeatmap={setShowHeatmap}
            gradientIdx={gradientIdx}
            setGradientIdx={setGradientIdx}
            setRadius={setRadius}
            setOpacity={setOpacity}
          />
        </div>
        {/* Mapa */}
        <div className="flex-1 flex items-center justify-center px-4 pb-4">
          <HeatMapGoogleMap
            containerStyle={containerStyle}
            center={center}
            zoom={14}
            mapTypeId="satellite"
            handleMapLoad={handleMapLoad}
            showHeatmap={showHeatmap}
            heatmapDataPoints={heatmapDataPoints}
            gradients={gradients}
            gradientIdx={gradientIdx}
            radius={radius}
            opacity={opacity}
            apiKey="AIzaSyDoHvawd_aRudxtYcxiyoDvyAcyJeFFA0w"
          />
        </div>
      </div>
    </div>
  );
}