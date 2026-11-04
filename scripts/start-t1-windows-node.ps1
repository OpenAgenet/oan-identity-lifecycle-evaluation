param([Parameter(Mandatory=$true)][string]$RunDirectory,[Parameter(Mandatory=$true)][string]$SourceBinary,[Parameter(Mandatory=$true)][ValidateSet('registrar-a','registrar-b','discovery-a')][string]$Role,[Parameter(Mandatory=$true)][string]$ListenAddress)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$run=(Resolve-Path -LiteralPath $RunDirectory).Path
if($run -notmatch 'oan-identity-lifecycle-evaluation\\runs\\t1\\(g2-[a-z0-9-]+)(\\deployment)?$'){throw 'Not isolated run'}
$id=$Matches[1]
if($ListenAddress -notmatch '^100\.\d+\.\d+\.\d+$'){throw 'Not experiment listener'}
$port=if($Role -eq 'discovery-a'){28102}else{28101}
if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){throw 'Port occupied; will not stop any process'}
$config=Join-Path $run "config/$Role.toml"
$text=Get-Content -LiteralPath $config -Raw -Encoding UTF8
if($text -notmatch ('host = "'+[regex]::Escape($ListenAddress)+'"')){throw 'Listener/config mismatch'}
$package=if($Role -eq 'discovery-a'){'discovery-node'}else{'registrar-node'}
$source=(Resolve-Path -LiteralPath $SourceBinary).Path
if($source -notmatch ('\\target\\release\\'+$package+'\.exe$')){throw 'Expected existing release executable'}
$taskName="OAN-TETC-$Role-$id"
if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){throw 'Task exists; refusing replacement'}
$bin=Join-Path $run 'bin'; New-Item -ItemType Directory -Path $bin -Force | Out-Null
$exe=Join-Path $bin "$package.exe"
if(Test-Path -LiteralPath $exe){throw 'Binary already exists'}
Copy-Item -LiteralPath $source -Destination $exe
$action=New-ScheduledTaskAction -Execute $exe -Argument "`"$config`"" -WorkingDirectory $run
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings -Description 'Isolated OAN TETC node; never production' | Out-Null
Start-ScheduledTask -TaskName $taskName
$record=@{task=$taskName;binary=$exe;sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash;config=$config;role=$Role;port=$port;listenAddress=$ListenAddress;requestedAt=[DateTime]::UtcNow.ToString('o');state='start-requested-not-health-verified'}
[IO.File]::WriteAllText((Join-Path $run "$Role-process.json"),($record|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
Write-Output "$Role experiment task started; readiness checked separately"
