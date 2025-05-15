import React, { useState, useEffect } from "react";

type AccordionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  forceClose?: boolean;
};

export default function Accordion({
  title,
  children,
  defaultOpen = false,
  forceClose = false,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [shouldRender, setShouldRender] = useState(defaultOpen);

  useEffect(() => {
    if (open) setShouldRender(true);
    else {
      const timeout = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  useEffect(() => {
    if (forceClose) setOpen(false);
  }, [forceClose]);

  return (
    <div className="mb-2 border rounded w-full">
      <button
        type="button"
        className="w-full text-left px-2 py-1 font-semibold bg-gray-200 hover:bg-gray-300 rounded-t flex justify-between items-center"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <span>{open ? "▲" : "▼"}</span>
      </button>
      <div className={`accordion-content w-full ${open ? "open" : "closed"}`}>
        {shouldRender && <div className="p-2 w-full">{children}</div>}
      </div>
    </div>
  );
}