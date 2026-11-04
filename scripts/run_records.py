import argparse
import hashlib
import json
from pathlib import Path
import re
import datetime

ROOT=Path(__file__).resolve().parents[1]
STATES={'accepted','rejected','unknown','timeout','transport-error','unsupported'}

def validate_event(event):
    required={'runId','scenario','node','subject','version','startNs','endNs','expected','actual','scope'}
    if not required.issubset(event):
        raise ValueError('missing required event fields')
    if type(event['startNs']) is not int or type(event['endNs']) is not int or event['startNs']<0 or event['endNs']<event['startNs']:
        raise ValueError('invalid monotonic interval')
    if event['actual'] not in STATES or event['scope'] not in {'end-to-end','component','service-ablation'}:
        raise ValueError('invalid event classification')
    if any(not isinstance(event[k],str) or not event[k] for k in ('runId','scenario','node','subject','version','expected')):
        raise ValueError('nonempty string labels required')
    return event

def prepare(run_id,config_path,root=ROOT):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}',run_id):
        raise ValueError('invalid run id')
    raw=Path(config_path).read_bytes()
    config=json.loads(raw.decode('utf-8'))
    from evaluate import validate
    validate(config)
    target=Path(root)/'runs'/run_id
    target.mkdir(parents=True,exist_ok=False)
    manifest={'runId':run_id,'state':'prepared-not-executed','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'configSha256':hashlib.sha256(raw).hexdigest(),'buildsVerified':False,'isolationVerified':False,'endpointsVerified':False}
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    (target/'config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (target/'events.jsonl').write_text('',encoding='utf-8')
    return manifest

def check_events(path):
    count=0;run_id=None
    for number,line in enumerate(Path(path).read_text(encoding='utf-8').splitlines(),1):
        if not line.strip():continue
        try:
            event=validate_event(json.loads(line))
            if run_id is not None and event['runId']!=run_id:raise ValueError('mixed run ids')
            run_id=event['runId'];count+=1
        except (ValueError,TypeError) as error:
            raise ValueError(f'line {number}: {error}') from error
    if not count:raise ValueError('empty event file is not evidence')
    return {'eventsValidated':count,'runId':run_id,'note':'Structural validation only; does not establish cryptographic validity or completeness'}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='action',required=True)
    prep=sub.add_parser('prepare');prep.add_argument('--run-id',required=True);prep.add_argument('--config',type=Path,default=ROOT/'configs/experiment.json')
    check=sub.add_parser('check-events');check.add_argument('path',type=Path)
    args=parser.parse_args()
    try:
        result=prepare(args.run_id,args.config) if args.action=='prepare' else check_events(args.path)
    except (ValueError,OSError,KeyError) as error:
        parser.exit(2,str(error)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
