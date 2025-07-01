type HeatMapControlsProps = {
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  gradientIdx: number;
  setGradientIdx: (v: number) => void;
  setRadius: React.Dispatch<React.SetStateAction<number | undefined>>;
  setOpacity: React.Dispatch<React.SetStateAction<number | undefined>>;
};

export function HeatMapControls({
  showHeatmap,
  setShowHeatmap,
  gradientIdx,
  setGradientIdx,
  setRadius,
  setOpacity,
}: HeatMapControlsProps) {
  return (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setShowHeatmap(!showHeatmap)}
        className="px-3 py-1 bg-green-700 text-white rounded"
      >
        {showHeatmap ? "Ocultar Heatmap" : "Mostrar Heatmap"}
      </button>
      <button
        onClick={() => setGradientIdx(gradientIdx + 1)}
        className="px-3 py-1 bg-blue-700 text-white rounded"
      >
        Alterar Gradiente
      </button>
      <button
        onClick={() => setRadius((prev) => (prev ? undefined : 30))}
        className="px-3 py-1 bg-yellow-700 text-white rounded"
      >
        Alterar Raio
      </button>
      <button
        onClick={() => setOpacity((o) => (o ? undefined : 0.3))}
        className="px-3 py-1 bg-purple-700 text-white rounded"
      >
        Alterar Opacidade
      </button>
    </div>
  );
}