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

export const telefoneRaw = (value?: string | null) => (value ?? "").replace(/\D/g, "");

export const telefoneBR = (value?: string | null) => {
  let digits = telefoneRaw(value);
  if (!digits) return "";
  // Remove zeros de discagem e o DDI 55 para exibição local.
  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);

  if (digits.length >= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length >= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length >= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length >= 2) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return digits;
};

