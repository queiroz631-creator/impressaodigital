export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const numeroBR = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export const dataBR = (value?: string | null) => {
  if (!value) return "-";
  // Datas "YYYY-MM-DD" (sem horário) são interpretadas como UTC por new Date,
  // o que desloca o dia em fusos a oeste. Tratamos como data pura local.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const [, ano, mes, dia] = m;
    return `${dia}/${mes}/${ano}`;
  }
  return new Date(value).toLocaleDateString("pt-BR");
};

export const dataHoraBR = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";