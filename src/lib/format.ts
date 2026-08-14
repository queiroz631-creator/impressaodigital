export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const numeroBR = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export const dataBR = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "-";

export const dataHoraBR = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";