param(
 [Parameter(Mandatory=$true)][string]$PostgresBin,
 [Parameter(Mandatory=$true)][string]$ExperimentRoot
)
$ErrorActionPreference='Stop'
$resolved=[IO.Path]::GetFullPath($ExperimentRoot)
if($resolved -notmatch '\\oan-identity-lifecycle-evaluation\\runs\\t1\\[a-zA-Z0-9_-]+$') { throw 'Expected an isolated experiment run root' }
$data=Join-Path $resolved 'postgres'
if(Test-Path -LiteralPath $data){throw 'Database directory already exists; refusing overwrite'}
if(Get-NetTCPConnection -State Listen -LocalPort 25432 -ErrorAction SilentlyContinue){throw 'Experiment port is occupied'}
New-Item -ItemType Directory -Force -Path $resolved | Out-Null
$utf8=[Text.UTF8Encoding]::new($false)
$randomBytes=New-Object byte[] 32
$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
try{$rng.GetBytes($randomBytes)}finally{$rng.Dispose()}
$password=[Convert]::ToBase64String($randomBytes)
$passwordFile=Join-Path $resolved 'postgres-password.local'
[IO.File]::WriteAllText($passwordFile,$password,$utf8)
& icacls.exe $passwordFile /inheritance:r /grant:r "${env:USERNAME}:(F)" '*S-1-5-18:(F)' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Cannot restrict password file'}
& (Join-Path $PostgresBin 'initdb.exe') -D $data -U oan_tetc --encoding=UTF8 --locale=C --auth-host=scram-sha-256 --auth-local=scram-sha-256 "--pwfile=$passwordFile"
if($LASTEXITCODE -ne 0){throw 'initdb failed'}
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $data -l (Join-Path $resolved 'postgres.log') -o '-p 25432 -h 127.0.0.1' -w start
if($LASTEXITCODE -ne 0){throw 'Experiment postgres failed to start'}
$record=@{port=25432;host='127.0.0.1';user='oan_tetc';data=$data;bin=$PostgresBin;passwordFile=$passwordFile;scope='experiment-only'}
[IO.File]::WriteAllText((Join-Path $resolved 'postgres-manifest.json'),($record|ConvertTo-Json),$utf8)
Write-Output 'Experiment PostgreSQL started on loopback:25432; password not printed'
