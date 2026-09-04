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
  const digits = telefoneRaw(value);
  if (digits.length > 11) {
    const ddd = digits.slice(-13, -11);
    const prefix = digits.slice(-11, -9);
    const first = digits.slice(-9, -4);
    const second = digits.slice(-4);
    return `+${ddd} (${prefix}) ${first}-${second}`;
  }
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
