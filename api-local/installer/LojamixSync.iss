#define MyAppName "Lojamix Sync"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Queiroz Tecnologia"
#define MyAppExeName "LojamixSync.exe"
#define MyServiceExeName "LojamixSyncService.exe"

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
Source: "..\build\LojamixSyncService.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Lojamix Sync"; Filename: "{app}\LojamixSync.exe"
Name: "{userdesktop}\Lojamix Sync"; Filename: "{app}\LojamixSync.exe"

[Run]
Filename: "{app}\LojamixSyncService.exe"; Parameters: "install"; Flags: runhidden waituntilterminated
Filename: "{app}\LojamixSyncService.exe"; Parameters: "--startup auto"; Flags: runhidden waituntilterminated
Filename: "{app}\LojamixSyncService.exe"; Parameters: "start"; Flags: runhidden waituntilterminated
Filename: "{app}\LojamixSync.exe"; Description: "Abrir Lojamix Sync"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\LojamixSyncService.exe"; Parameters: "stop"; Flags: runhidden waituntilterminated
Filename: "{app}\LojamixSyncService.exe"; Parameters: "remove"; Flags: runhidden waituntilterminated
