export function identificarClienteCurriculo(clienteVinculado: string | null, candidatos: { id: string }[]) {
  if (clienteVinculado) return { clienteId: clienteVinculado, ambiguo: false };
  if (candidatos.length > 1) return { clienteId: null, ambiguo: true };
  return { clienteId: candidatos[0]?.id ?? null, ambiguo: false };
}