import argparse
import datetime
import json
import pathlib
import platform
import random
from urllib.parse import urlparse
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = ['pipeline-benchmark.ts', 'mixed-resource-pipeline-benchmark.ts', 'multi-node-pipeline-benchmark.ts', 'multi-node-mixed-resource-pipeline-benchmark.ts']

def validate(c):
    if c.get('schemaVersion') != 1 or c.get('repetitions') != 5:
        raise ValueError('schemaVersion=1 and five independent repetitions required')
    for key in ('single', 'multi', 'mixed'):
        values = c['totalResourceScales'][key]
        if not values or any(type(n) is not int or n <= 0 for n in values) or len(set(values)) != len(values):
            raise ValueError('scales must be unique positive integers')
    if 2000 not in c['totalResourceScales']['single']:
        raise ValueError('2000-resource comparison is required')
    if set(c['hosts']) != {'laptop-a', 'laptop-b', 'cloud'}:
        raise ValueError('three host definitions required')
    expected = {'driver','registrar-1','client','registrar-2','discovery-1','root','registrar-3','discovery-2','postgres','nats','cdn','publisher'}
    roles = [role for host in c['hosts'].values() for role in host['roles']]
    if len(roles) != len(set(roles)) or set(roles) != expected:
        raise ValueError('roles must be complete and uniquely assigned')
    for value in c['serviceEndpoints'].values():
        if value is not None and (urlparse(value).scheme not in ('http','https') or not urlparse(value).hostname or urlparse(value).username or urlparse(value).password):
            raise ValueError('endpoint must be an HTTP(S) URL without credentials')
    if type(c['seed']) is not int:
        raise ValueError('integer seed required')
    if c['executionPolicy']['modifyCoreModules'] != 'ablation-only' or c['ablation']['executionScope'] != 'actual-service-path':
        raise ValueError('core changes limited to actual-service ablation builds')
    if not all(c['ablation']['buildPolicy'].values()):
        raise ValueError('all ablation isolation safeguards required')
    for capability in c['capabilities'].values():
        if capability['status'] not in ('unverified','supported','component-only','unsupported'):
            raise ValueError('invalid capability status')
        if capability['status'] == 'supported' and not (capability.get('interface') and capability.get('evidenceSource')):
            raise ValueError('supported capability needs interface and evidence source')
    if c['query']['warmup'] < 20 or c['query']['concurrency'] != 1:
        raise ValueError('query warmup >=20 and concurrency=1 required')
    if c['query']['pageSize'] <= 0 or c['query']['samplesPerRun'] < 200:
        raise ValueError('invalid query configuration')
    if any(type(n) is not int or n <= 0 for n in c['timeoutsSeconds'].values()):
        raise ValueError('timeouts must be positive integers')

def readiness(c):
    validate(c)
    missing = [key for key, value in c['serviceEndpoints'].items() if not value]
    capabilities = [key for key, value in c['capabilities'].items() if value['status'] == 'unverified']
    return dict(readyToRun=False, missingServiceEndpoints=missing,
                unauditedCapabilities=capabilities,
                remainingDrivers=['deployment', 'registration', 'observation', 'lifecycle', 'query', 'ablation'],
                note='Configuration readiness does not establish executable driver readiness')

def plan(c):
    validate(c)
    rows = []
    for topology, workload, scales in [('T0-single','agent','single'),('T0-multi','agent','multi'),('T1-three-host','agent','multi'),('T0-single','mixed','mixed'),('T1-three-host','mixed','mixed')]:
        for n in c['totalResourceScales'][scales]:
            count = 1 if topology == 'T0-single' else 3
            allocation = [n // count + (i < n % count) for i in range(count)]
            for repeat in range(1, c['repetitions'] + 1):
                rows.append(dict(topology=topology,workload=workload,totalResources=n,registrarAllocation=allocation,repetition=repeat,status='planned'))
    random.Random(c['seed']).shuffle(rows)
    for index, row in enumerate(rows):
        row['cellId'] = f"cell-{index + 1:03d}"
        row['seed'] = c['seed'] + index
    lifecycle = [dict(topology=t,scenario=scenario,round=round_number,
                      identities=c['lifecycle']['identitiesPerRound'],status='planned',
                      capability=c['capabilities'][scenario]['status'],
                      executionScope=('excluded' if c['capabilities'][scenario]['status']=='unsupported' else 'component' if c['capabilities'][scenario]['status']=='component-only' else 'pending-audit'))
                 for t in ('T0-multi','T1-three-host')
                 for scenario in c['lifecycle']['scenarios']
                 for round_number in range(1,c['lifecycle']['rounds']+1)]
    ablations = [dict(topology=t,mechanism=mechanism,status='planned',paired=True,executionScope='actual-service-path')
                 for t in ('T0-multi','T1-three-host') for mechanism in c['ablation']['mechanisms']]
    return dict(status='planned-only',seed=c['seed'],performanceCells=rows,lifecycleCells=lifecycle,ablationCells=ablations,readiness=readiness(c))

def command(args):
    try:
        p = subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=20)
        return p.stdout.strip() if p.returncode == 0 else None
    except (OSError,subprocess.TimeoutExpired):
        return None

def environment():
    data = dict(capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),platform=platform.platform(),machine=platform.machine(),python=sys.version,node=command(['node','--version']),rust=command(['rustc','--version']),hardware=None)
    if sys.platform == 'win32':
        data['hardware'] = command(['powershell','-NoProfile','-Command',"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; @{cpu=(Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors); memoryBytes=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory} | ConvertTo-Json -Depth 4"])
    else:
        data['hardware'] = dict(cpu=command(['lscpu']),memory=command(['free','-b']))
    return data

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['validate','plan','environment'])
    parser.add_argument('--config',type=pathlib.Path,default=ROOT/'configs/experiment.json')
    parser.add_argument('--output',type=pathlib.Path)
    args=parser.parse_args()
    if args.action == 'environment':
        result=environment()
    else:
        c=json.loads(args.config.read_text(encoding='utf-8'));validate(c)
        if args.action == 'plan':
            result=plan(c)
        else:
            source=(ROOT/c['harnessRelativePath']).resolve()/'scripts/bench'
            result=dict(configValid=True,missingReferenceSources=[name for name in SOURCES if not (source/name).is_file()],**readiness(c))
    text=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text,encoding='utf-8')
    else:
        print(text)

if __name__ == '__main__':
    main()
