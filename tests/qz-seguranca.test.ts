import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/qz-assinatura.functions', () => ({
  obterCertificadoQz: vi.fn(), assinarPedidoQz: vi.fn(),
}));
import { obterCertificadoQz, assinarPedidoQz } from '../src/lib/qz-assinatura.functions';
import { configurarSegurancaQz } from '../src/lib/qz-seguranca';

const certificado = vi.mocked(obterCertificadoQz);
const assinar = vi.mocked(assinarPedidoQz);
const apiFake = () => ({ api: { setSha256Type: vi.fn() }, security: { setCertificatePromise: vi.fn(), setSignatureAlgorithm: vi.fn(), setSignaturePromise: vi.fn() } });
describe('QZ client security', () => {
  beforeEach(() => vi.resetAllMocks());
  it('preserves existing anonymous prompts when unconfigured', async () => {
    certificado.mockResolvedValue({ certificado: null });
    const api = apiFake();
    await configurarSegurancaQz(api);
    expect(api.security.setCertificatePromise).not.toHaveBeenCalled();
  });
  it('passes exact original JSON to the server and never sends only a blind hash', async () => {
    certificado.mockResolvedValue({ certificado: 'PUBLIC-TEST' });
    assinar.mockResolvedValue({ assinatura: 'SIGNED-TEST' });
    const api = apiFake();
    await configurarSegurancaQz(api);
    expect(api.security.setSignatureAlgorithm).toHaveBeenCalledWith('SHA512');
    expect(api.security.setCertificatePromise.mock.calls[0][1]).toEqual({ rejectOnFailure: true });
    const hashFn = api.api.setSha256Type.mock.calls[0][0];
    const signFn = api.security.setSignaturePromise.mock.calls[0][0];
    const mensagem = JSON.stringify({ call: 'printers.find', params: {}, timestamp: Date.now() });
    const hash = await hashFn(mensagem);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const assinatura = await new Promise((resolve, reject) => signFn(hash)(resolve, reject));
    expect(assinatura).toBe('SIGNED-TEST');
    expect(assinar).toHaveBeenCalledWith({ data: { mensagem } });
    await expect(new Promise((resolve, reject) => signFn(hash)(resolve, reject))).rejects.toThrow('não identificado');
  });
  it('fails closed when certificate retrieval fails', async () => {
    certificado.mockRejectedValue(new Error('Configuração incompleta'));
    const api = apiFake();
    await expect(configurarSegurancaQz(api)).rejects.toThrow('Configuração incompleta');
    expect(api.security.setSignaturePromise).not.toHaveBeenCalled();
  });
});