#define ProductName "Strategic Data Fusion"
#define AppExeName "Strategic Data Fusion.exe"
#ifndef AppVersion
#define AppVersion "1.0.0"
#endif

[Setup]
AppId={{8D88CE66-72EC-4F5E-9BA4-F13CA34DC671}
AppName={#ProductName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\Strategic Data Fusion
DefaultGroupName=Strategic Data Fusion
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#SourcePath}\..\release
OutputBaseFilename=Strategic Data Fusion-Setup-{#AppVersion}-x64
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#AppExeName}
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "{#SourcePath}\..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourcePath}\..\resources\ai\*.gguf"; DestDir: "{app}\resources\ai"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#ProductName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#ProductName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#ProductName}"; Flags: nowait postinstall skipifsilent
