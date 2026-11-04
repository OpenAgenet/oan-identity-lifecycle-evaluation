param([Parameter(Mandatory=$true)][string]$RunDirectory,[Parameter(Mandatory=$true)][ValidateSet('registrar-a','registrar-b','discovery-a')][string]$Role)
$ErrorActionPreference='Stop'
$run=(Resolve-Path -LiteralPath $RunDirectory).Path
if($run -notmatch 'oan-identity-lifecycle-evaluation\\runs\\t1\\(g2-[a-z0-9-]+)(\\deployment)?$'){throw 'Not isolated run'}
$id=$Matches[1]
$record=Get-Content -LiteralPath (Join-Path $run "$Role-process.json") -Raw -Encoding UTF8|ConvertFrom-Json
$expectedTask="OAN-TETC-$Role-$id"
if($record.task -ne $expectedTask -or $record.role -ne $Role){throw 'Ownership record mismatch'}
$exe=(Resolve-Path -LiteralPath $record.binary).Path
if(-not $exe.StartsWith(($run+'\'),[StringComparison]::OrdinalIgnoreCase)){throw 'Binary outside run'}
if((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ne $record.sha256){throw 'Binary hash mismatch'}
$task=Get-ScheduledTask -TaskName $expectedTask
if($task.Actions.Count -ne 1 -or $task.Actions[0].Execute -ne $exe){throw 'Task action mismatch'}
$listeners=@(Get-NetTCPConnection -State Listen -LocalPort $record.port -ErrorAction SilentlyContinue)
foreach($listener in $listeners){
 $process=Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
 if($process.ExecutablePath -ne $exe){throw 'Port is owned by another executable; refusing stop'}
}
Stop-ScheduledTask -TaskName $expectedTask
Write-Output 'Only matching experiment task stopped; database, files, and unrelated processes preserved'
