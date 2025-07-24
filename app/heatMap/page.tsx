/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { useHeatMapViewModel, gradients } from "./useHeatMapViewModel";
import { HeatMapControls } from "./HeatMapControls";
import { HeatMapGoogleMap } from "./HeatMapGoogleMap";
import entregasJson from "../../lib/entregas.json";
import Image from "next/image";
import { useRouter } from "next/navigation";
import "../SendButton.css";

const containerStyle = {
  width: "100%",
  height: "70vh",
};
const center = { lat: -23.2645, lng: -47.2992 };

function extrairLatLngDeEntregas(
  jsonEntregas: any
): { lat: number; lng: number }[] {
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
  const [darkMode, setDarkMode] = useState(false);
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [cidadeFiltro, setCidadeFiltro] = useState(""); // 1. Estado para cidade digitada
  const [pontosFiltrados, setPontosFiltrados] = useState(pontosHeatmap); // 1. Estado para pontos filtrados

  const router = useRouter();

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  // Atualize o useHeatMapViewModel para usar pontosFiltrados:
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
  } = useHeatMapViewModel(pontosFiltrados); // use pontosFiltrados

  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center ${
        darkMode ? "bg-[#222]" : "bg-gray-100"
      }`}
    >
      {/* Botão de modo escuro */}
      <button
        onClick={() => setDarkMode((prev) => !prev)}
        className={`
          fixed top-4 right-4 z-50 w-14 h-7 flex items-center rounded-full p-1
          transition-colors duration-500
          ${darkMode ? "bg-[#14532d]" : "bg-gray-300"}
        `}
        aria-label="Alternar modo escuro"
        type="button"
      >
        <div
          className={`
            w-6 h-6 rounded-full bg-white shadow-md transform
            transition-transform duration-300 flex items-center justify-center
            ${darkMode ? "translate-x-7" : "translate-x-0"}
          `}
        >
          {darkMode ? (
            <span
              role="img"
              aria-label="Lua"
              className="text-yellow-400 text-lg"
            >
              🌙
            </span>
          ) : (
            <span
              role="img"
              aria-label="Sol"
              className="text-yellow-500 text-lg"
            >
              ☀️
            </span>
          )}
        </div>
      </button>

      <div className="relative flex justify-center items-center w-full sm:max-w-4xl gap-0 mx-auto">
        {/* Card do mapa */}
        <div
          className={`
            flex flex-col w-full sm:max-w-2xl h-[80vh] sm:h-[90vh]
            rounded-2xl shadow-2xl overflow-hidden
            border
            ${
              darkMode
                ? "bg-[#232b2b] text-white border-[#333]"
                : "bg-white text-gray-900 border-gray-200"
            }
            transition-all duration-500
            relative
          `}
          style={{
            boxShadow: darkMode
              ? "0 8px 32px 0 rgba(0,0,0,0.8)"
              : "0 8px 32px 0 rgba(0,0,0,0.15)",
          }}
        >
          {/* Botão de voltar */}
          <button
            onClick={() => router.push("/")}
            className={`
              fixed top-1/2 left-0 z-50
              flex items-center
              bg-green-600 text-white
              rounded-r-full
              shadow-lg
              transition-all duration-300
              pl-2 pr-4 py-2
              -translate-y-1/2
              group
              hover:left-0 hover:pl-4
              w-12 hover:w-40
              cursor-pointer
              overflow-hidden
              ${darkMode ? "bg-green-900" : ""}
            `}
            title="Voltar ao Chatbot"
          >
            <span className="text-2xl">💬</span>
            <span
              className={`
                ml-3 text-base font-bold opacity-0
                group-hover:opacity-100
                transition-opacity duration-300
                whitespace-nowrap
                pointer-events-none
              `}
              style={{ width: "0", display: "inline-block" }}
            >
              Chatbot
            </span>
          </button>
          {/* Cabeçalho */}
          <div
            className={`relative ${
              darkMode ? "bg-green-900" : "bg-green-600"
            } text-white p-4 flex items-center justify-center transition-colors duration-500`}
          >
            <h1 className="text-xl font-bold w-full text-center">
              Mapa de Calor
            </h1>
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
          <div
            className={`p-4 ${
              darkMode ? "bg-[#232b2b]" : "bg-white"
            } transition-colors duration-500`}
          >
            <HeatMapControls
              showHeatmap={showHeatmap}
              setShowHeatmap={setShowHeatmap}
              gradientIdx={gradientIdx}
              setGradientIdx={setGradientIdx}
              setRadius={setRadius}
              setOpacity={setOpacity}
              darkMode={darkMode}
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

        {/* Botão de filtro e card, se quiser manter */}
        {!showFilterCard && (
          <button
            className="heatmap-filter-btn"
            onClick={() => setShowFilterCard(true)}
            type="button"
          >
            Filtros
          </button>
        )}
        <div
          className={`heatmap-filter-card bg-white ${
            showFilterCard ? " open" : ""
          }`}
        >
          <div
            className={`relative ${
              darkMode ? "bg-green-900" : "bg-green-600"
            } text-white p-4 flex items-center justify-between transition-colors duration-500`}
          >
            <h2 className="text-lg font-bold w-full text-center">
              Filtros do Mapa
            </h2>
            <button
              className="ml-2 px-2 py-1 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition"
              onClick={() => setShowFilterCard(false)}
              type="button"
              title="Fechar"
            >
              ✕
            </button>
          </div>
          <div
            className={`p-4 ${
              darkMode ? "bg-[#232b2b]" : "bg-white"
            } transition-colors duration-500 flex-1`}
          >
            <label className="block mb-2 font-semibold">Cidade</label>
            <input
              type="text"
              className={`w-full p-2 rounded border mb-4 ${
                darkMode ? "placeholder-white" : "placeholder-gray-400"
              }`}
              placeholder="Digite a cidade"
              value={cidadeFiltro}
              onChange={(e) => setCidadeFiltro(e.target.value)}
            />
            <label className="block mb-2 font-semibold">Bairro</label>
            <input
              type="text"
              className={`w-full p-2 rounded border mb-4 ${
                darkMode ? "placeholder-white" : "placeholder-gray-400"
              }`}
              placeholder="Digite o bairro"
            />

            <label className="block mb-2 font-semibold">Data da Entrega</label>
            <input
              type="date"
              className={`w-full p-2 rounded border mb-4 ${
                darkMode ? "placeholder-white" : "placeholder-gray-400"
              }`}
            />

            <label className="block mb-2 font-semibold">Status</label>
            <select
              className={`w-full p-2 rounded border mb-4 ${
                darkMode
                  ? "bg-[#232b2b] text-white placeholder-white border-[#333]"
                  : "bg-white text-black placeholder-gray-400 border-gray-300"
              }`}
            >
              <option value="">Selecione</option>
              <option value="pendente">Pendente</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
            {/* Fim dos novos filtros */}

            <button
              className="w-full bg-green-600 text-white rounded py-2 font-bold hover:bg-green-700 transition"
              disabled={!cidadeFiltro.trim()}
              onClick={() => {
                // Filtra diretamente pelo campo city dentro de addresses
                const pontos: { lat: number; lng: number }[] = [];
                Object.values(entregasJson).forEach((entrega: any) => {
                  if (Array.isArray(entrega.addresses)) {
                    entrega.addresses.forEach((addr: any) => {
                      if (
                        typeof addr.lat === "number" &&
                        typeof addr.lng === "number" &&
                        typeof addr.city === "string" &&
                        addr.city
                          .toLowerCase()
                          .includes(cidadeFiltro.trim().toLowerCase())
                      ) {
                        pontos.push({ lat: addr.lat, lng: addr.lng });
                      }
                    });
                  }
                });
                setPontosFiltrados(pontos);
                setShowFilterCard(false);
              }}
            >
              Filtrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
