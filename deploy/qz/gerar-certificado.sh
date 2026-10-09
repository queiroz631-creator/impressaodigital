#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" != 0 ]; then echo 'Execute este script como root na VPS.' >&2; exit 1; fi
command -v openssl >/dev/null || { echo 'Instale o OpenSSL antes de continuar.' >&2; exit 1; }
DESTINO=/etc/impressaodigital/qz
if [ -e "$DESTINO" ] || [ -e /etc/impressaodigital/qz.env ]; then
  echo 'Já existe uma configuração QZ. Nada foi substituído. Consulte deploy/qz/README.md.' >&2; exit 1
fi
umask 077
mkdir -p "$DESTINO"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$DESTINO/private-key.pem" 2>/dev/null
openssl req -new -x509 -sha256 -days 730 -key "$DESTINO/private-key.pem" \
  -subj '/O=Impressao Digital/CN=Impressao Digital - Impressao Interna' \
  -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,digitalSignature,keyCertSign' \
  -out "$DESTINO/digital-certificate.txt"
{
  printf 'QZ_PRIVATE_KEY_BASE64=%s\n' "$(base64 -w0 "$DESTINO/private-key.pem")"
  printf 'QZ_CERTIFICATE_BASE64=%s\n' "$(base64 -w0 "$DESTINO/digital-certificate.txt")"
} > /etc/impressaodigital/qz.env
chmod 600 /etc/impressaodigital/qz.env "$DESTINO/private-key.pem"
echo 'Certificado criado. Chave privada protegida em /etc/impressaodigital/qz.'
echo 'Copie SOMENTE digital-certificate.txt para os computadores Windows.'
echo 'Confira a identidade pública do certificado:'
openssl x509 -in "$DESTINO/digital-certificate.txt" -noout -fingerprint -sha256 -enddate
echo 'Execute novamente bash deploy/deploy.sh para carregar a assinatura no PM2.'
