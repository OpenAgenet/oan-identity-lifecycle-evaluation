param([Parameter(Mandatory=$true)][string]$RunDirectory,[Parameter(Mandatory=$true)][string]$InfrastructureDirectory)
$ErrorActionPreference='Stop'
$run=(Resolve-Path -LiteralPath $RunDirectory).Path
$infra=(Resolve-Path -LiteralPath $InfrastructureDirectory).Path
if($run -notmatch 'oan-identity-lifecycle-evaluation\\runs\\t1\\g2-[a-z0-9-]+(\\deployment)?$'){throw 'Not an isolated T1 run'}
if($infra -notmatch 'oan-identity-lifecycle-evaluation\\runs\\t1\\infrastructure-'){throw 'Not isolated infrastructure'}
$manifest=Get-Content (Join-Path $infra 'postgres-manifest.json') -Encoding UTF8|ConvertFrom-Json
if($manifest.port -ne 25432 -or $manifest.user -ne 'oan_tetc'){throw 'Wrong cluster'}
$previousPassword=$env:PGPASSWORD
try{
 $env:PGPASSWORD=[IO.File]::ReadAllText($manifest.passwordFile,[Text.Encoding]::UTF8).Trim()
 foreach($file in Get-ChildItem -LiteralPath (Join-Path $run 'config') -Filter '*.toml'){
  $text=Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
  if($text -notmatch '(?m)^database_url = "postgresql://[^\r\n]+/(oan_tetc_[a-z0-9_]+)"$'){continue}
  $database=$Matches[1]
  $found=& (Join-Path $manifest.bin 'psql.exe') -h 127.0.0.1 -p 25432 -U oan_tetc -d postgres -At -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname='$database'"
  if($LASTEXITCODE -ne 0){throw 'Cluster connection failed'}
  if($found -eq '1'){throw "Database already exists: $database; refusing reuse"}
  & (Join-Path $manifest.bin 'createdb.exe') -h 127.0.0.1 -p 25432 -U oan_tetc $database
  if($LASTEXITCODE -ne 0){throw "Database creation failed: $database"}
  Write-Output "Created isolated database $database"
 }
}finally{$env:PGPASSWORD=$previousPassword}
