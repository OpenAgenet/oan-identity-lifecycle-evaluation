import argparse,json,math
from pathlib import Path

def summarize(rows):
    groups={}
    for row in rows:
        if row['elapsedMs']<0 or not math.isfinite(row['elapsedMs']):raise ValueError('invalid duration')
        key=(row['module'],row['caseId'])
        groups.setdefault(key,[]).append(row)
    result=[]
    for (module,case),values in groups.items():
        times=sorted(x['elapsedMs'] for x in values if x['actual']=='matched')
        percentile=lambda p:times[max(0,math.ceil(p*len(times))-1)] if times else None
        result.append(dict(module=module,caseId=case,attempts=len(values),matched=len(times),failures=len(values)-len(times),matchedMedianMs=percentile(.5),matchedP95Ms=percentile(.95)))
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input',type=Path);parser.add_argument('--output',required=True,type=Path);args=parser.parse_args()
    rows=[json.loads(line) for line in args.input.read_text(encoding='utf-8').splitlines() if line.strip()]
    if not rows:raise ValueError('no measured observations')
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(summarize(rows),indent=2)+'\n',encoding='utf-8')
