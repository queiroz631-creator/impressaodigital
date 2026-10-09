# Certificado próprio QZ — VPS + Windows

Configuração interna sem certificado pago. A confiança precisa ser instalada explicitamente em **cada Windows**. O HTTPS do site não substitui este certificado. O procedimento troca a raiz confiável do QZ pelo certificado interno; outros sites com certificados oficiais QZ podem perder confiança nessa máquina. Não desativa proteções globais.

## 1. Na VPS

Após receber esta versão do projeto:

```bash
bash deploy/qz/gerar-certificado.sh
bash deploy/deploy.sh
```

O primeiro comando, executado como root, gera RSA 2048 / PKCS#8 e certificado de dois anos. Os arquivos privados ficam fora do repositório, em `/etc/impressaodigital/qz/` e `/etc/impressaodigital/qz.env`, com acesso restrito. O PM2 carrega esse arquivo adicional somente se existir. Nunca envie a chave privada ou qz.env para Windows, chat, Git ou pastas públicas. Guarde backup privado seguro; o gerador não sobrescreve configurações existentes.

Transfira via SFTP/SCP **somente** `/etc/impressaodigital/qz/digital-certificate.txt` e `deploy/qz/instalar-confianca-windows.ps1` para uma pasta no Windows. Anote o SHA-256 exibido na VPS.

## 2. Em cada Windows

1. Use QZ Tray 2.1 ou superior. Encerre pelo ícone na bandeja.
2. Coloque o certificado público e o script na mesma pasta.
3. Abra PowerShell **como administrador**, nessa pasta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\instalar-confianca-windows.ps1
```

A autorização de execução vale somente para esse processo, sem mudar a política permanente. Compare o SHA-256 com o da VPS e confirme `SIM`. O instalador não sobrescreve outro certificado.

4. Abra QZ Tray, recarregue o site da VPS e entre com seu usuário.
5. Na primeira impressão, o aviso deve mostrar **Impressao Digital - Impressao Interna**, não “anonymous / Untrusted website”. Marque **Remember this decision** e **Allow** uma vez. Pedidos posteriores corretamente assinados não devem repetir o aviso.

Se continuar “anonymous”, confira se executou o deploy após gerar o certificado e recarregue o site. Se “Untrusted”, confira `override.crt`, validade, relógio e reinicialização do QZ. Não autorize identidade diferente. Bloqueios antigos podem exigir revisão em QZ Tray > Advanced > Site Manager.

## Segurança e limites

Assinatura somente para usuários autenticados com permissões existentes de atendimento/impressão. O servidor limita chamadas a `print`, `printers.find` e `printers.getDefault`, valida prazo de dois minutos e restringe impressão a dados locais. Não assina acesso a arquivos, rede, USB ou serial do QZ. Segue SHA-256 + RSA/SHA-512 do protocolo. Falhas na configuração/assinatura não provocam impressão anônima.

Sem certificado configurado, as confirmações atuais são preservadas. Na hospedagem Lovable, a configuração permanece desativada até cadastrar os mesmos valores no armazenamento seguro; o arquivo `/etc/...` é exclusivo da VPS.

## Renovação e reversão

Renove antes de dois anos em manutenção planejada e distribua a nova confiança a todos os Windows. O gerador bloqueia substituição acidental. Para reverter, encerre QZ e remova **somente o override.crt deste procedimento**, preservando outros arquivos; revise a autorização no Site Manager. Na VPS desative o arquivo adicional de configuração e recarregue PM2 em manutenção. Não remova dados de impressão.

Referências: https://qz.io/docs/Signing e https://qz.io/docs/provisioning
