#define MyAppName "Lojamix Sync"
#define MyAppVersion "1.2.0"
#define MyAppPublisher "Queiroz Tecnologia"
#define MyAppExeName "LojamixSync.exe"

[Setup]
AppId={{9D4C4C8E-3C3C-4C8A-A3A5-LOJAMIXSYNC}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\LojamixSync
PrivilegesRequired=admin
OutputBaseFilename=LojamixSync_Setup_{#MyAppVersion}
Compression=lzma
SolidCompression=yes

[Files]
Source: "..\build\LojamixSync.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Lojamix Sync"; Filename: "{app}\LojamixSync.exe"
Name: "{userdesktop}\Lojamix Sync"; Filename: "{app}\LojamixSync.exe"

[Run]
Filename: "{app}\LojamixSync.exe"; Description: "Abrir Lojamix Sync"; Flags: nowait postinstall skipifsilent

[InstallDelete]
Type: files; Name: "{userstartup}\BackupImpressaoDigital.cmd"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueName: "BackupImpressaoDigital"; Flags: deletevalue
