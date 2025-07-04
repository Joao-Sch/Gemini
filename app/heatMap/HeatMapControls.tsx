type HeatMapControlsProps = {
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  gradientIdx: number;
  setGradientIdx: (v: number) => void;
  setRadius: React.Dispatch<React.SetStateAction<number | undefined>>;
  setOpacity: React.Dispatch<React.SetStateAction<number | undefined>>;
  darkMode: boolean; // NOVO
};

export function HeatMapControls({
  showHeatmap,
  setShowHeatmap,
  gradientIdx,
  setGradientIdx,
  setRadius,
  setOpacity,
  darkMode,
}: HeatMapControlsProps) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {/** Botão 1 */}
      <button
        onClick={() => setShowHeatmap(!showHeatmap)}
        className={`
          px-4 py-2 rounded-lg font-semibold border
          transition-all duration-300
          bg-green-600 text-white border-green-700
          shadow-sm
          hover:bg-green-700 hover:scale-105 hover:shadow-lg
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-green-400
          ${darkMode ? "bg-green-900 hover:bg-green-800 border-green-800" : ""}
        `}
      >
        {showHeatmap ? "Ocultar Heatmap" : "Mostrar Heatmap"}
      </button>
      {/** Botão 2 */}
      <button
        onClick={() => setGradientIdx(gradientIdx + 1)}
        className={`
          px-4 py-2 rounded-lg font-semibold border
          transition-all duration-300
          bg-green-600 text-white border-green-700
          shadow-sm
          hover:bg-green-700 hover:scale-105 hover:shadow-lg
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-green-400
          ${darkMode ? "bg-green-900 hover:bg-green-800 border-green-800" : ""}
        `}
      >
        Alterar Gradiente
      </button>
      {/** Botão 3 */}
      <button
        onClick={() => setRadius((prev) => (prev ? undefined : 30))}
        className={`
          px-4 py-2 rounded-lg font-semibold border
          transition-all duration-300
          bg-green-600 text-white border-green-700
          shadow-sm
          hover:bg-green-700 hover:scale-105 hover:shadow-lg
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-green-400
          ${darkMode ? "bg-green-900 hover:bg-green-800 border-green-800" : ""}
        `}
      >
        Alterar Raio
      </button>
      {/** Botão 4 */}
      <button
        onClick={() => setOpacity((o) => (o ? undefined : 0.3))}
        className={`
          px-4 py-2 rounded-lg font-semibold border
          transition-all duration-300
          bg-green-600 text-white border-green-700
          shadow-sm
          hover:bg-green-700 hover:scale-105 hover:shadow-lg
          active:scale-95
          focus:outline-none focus:ring-2 focus:ring-green-400
          ${darkMode ? "bg-green-900 hover:bg-green-800 border-green-800" : ""}
        `}
      >
        Alterar Opacidade
      </button>
    </div>
  );
}