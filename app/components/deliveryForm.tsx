import React from "react";
import Accordion from "@/app/myComponents/Accordion";

export default function DeliveryForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  accordionForceClose: boolean;
}) {
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev: any) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <form onSubmit={onSubmit} className="bg-white p-4 rounded-lg shadow mb-4 space-y-2">
      <h3 className="font-bold mb-2">Nova Entrega</h3>
      {/* ...coloque aqui os Accordions e inputs do formulário... */}
      <div className="flex gap-2">
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Adicionar
        </button>
        <button type="button" onClick={onCancel} className="bg-gray-400 text-white px-4 py-2 rounded">
          Cancelar
        </button>
      </div>
    </form>
  );
}