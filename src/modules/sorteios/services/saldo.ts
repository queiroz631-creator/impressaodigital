/**
 * Cálculo de cupons e saldo a partir de notas válidas.
 *
 * Etapa 1: apenas a regra pura (sem banco, sem geração de cupons).
 * Regra: cada `valorPorCupomCentavos` acumulado gera 1 cupom; o que sobra
 * fica como saldo da participação daquele sorteio.
 */

export interface ResultadoSaldo {
  cupons: number;
  saldoCentavos: number;
}

export function calcularCupons(
  saldoAtualCentavos: number,
  valorNotaCentavos: number,
  valorPorCupomCentavos: number,
): ResultadoSaldo {
  const total = Math.max(0, saldoAtualCentavos) + Math.max(0, valorNotaCentavos);
  if (valorPorCupomCentavos <= 0) return { cupons: 0, saldoCentavos: total };
  const cupons = Math.floor(total / valorPorCupomCentavos);
  return { cupons, saldoCentavos: total - cupons * valorPorCupomCentavos };
}
