import { describe, it, expect } from 'vitest';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { validarPedidoQz, assinarMensagemQz } from '../src/lib/qz-assinatura.server';

const agora = 1_800_000_000_000;
const pedido = (call: string, params: unknown = null, timestamp = agora) => JSON.stringify({ call, params, timestamp });
const impressao = (data: unknown, printer: unknown = { name: 'Teste' }) => pedido('print', { printer, data });
describe('QZ signing', () => {
  it('accepts local HTML, PDF and thermal text/cut without altering contents', () => {
    const mensagem = impressao([
      { type: 'pixel', format: 'html', flavor: 'plain', data: '<b>TESTE</b>' },
      { type: 'pixel', format: 'pdf', flavor: 'base64', data: 'VEVTVEU=' },
      { type: 'raw', format: 'plain', data: 'TESTE' },
      { type: 'raw', format: 'hex', data: '0A0A0A1D5600' },
    ]);
    expect(validarPedidoQz(mensagem, agora)).toEqual(JSON.parse(mensagem));
  });
  it('accepts printer discovery/default', () => {
    expect(() => validarPedidoQz(pedido('printers.find', {}), agora)).not.toThrow();
    expect(() => validarPedidoQz(pedido('printers.getDefault'), agora)).not.toThrow();
  });
  it('rejects expired/future timestamps and malformed messages', () => {
    for (const message of ['invalid', '[]', 'null', pedido('print', {}, agora - 120001), pedido('printers.find', {}, agora + 120001)]) {
      expect(() => validarPedidoQz(message, agora)).toThrow();
    }
  });
  it('rejects file/network/USB calls and redirected printers', () => {
    for (const call of ['file.read', 'socket.open', 'usb.sendData', 'serial.openPort']) expect(() => validarPedidoQz(pedido(call), agora)).toThrow();
    for (const printer of [{ host: 'localhost', port: 9100 }, { name: 'Teste', file: '/tmp/target' }]) {
      expect(() => validarPedidoQz(impressao([{ type: 'raw', format: 'plain', data: 'TESTE' }], printer), agora)).toThrow();
    }
    expect(() => validarPedidoQz(impressao([{ type: 'pixel', format: 'pdf', flavor: 'file', data: 'https://example.invalid/doc.pdf' }]), agora)).toThrow();
  });
  it('matches independent RSA/SHA512 verification over the SHA256 hexadecimal digest', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const mensagem = pedido('printers.find', {});
    const signature = await assinarMensagemQz(mensagem, Buffer.from(pem).toString('base64'));
    const digest = createHash('sha256').update(mensagem).digest('hex');
    expect(verify('RSA-SHA512', Buffer.from(digest), publicKey, Buffer.from(signature, 'base64'))).toBe(true);
    expect(verify('RSA-SHA512', Buffer.from(digest + 'tampered'), publicKey, Buffer.from(signature, 'base64'))).toBe(false);
  });
});