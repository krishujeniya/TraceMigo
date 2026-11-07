from pathlib import Path
import json,hashlib,struct
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'apps/web/public/brand'
frames=[(size,(OUT/f'favicon-{size}.png').read_bytes()) for size in [16,32,48]]
header=struct.pack('<HHH',0,1,len(frames));offset=6+16*len(frames);entries=[]
for size,data in frames:
 entries.append(struct.pack('<BBBBHHII',size,size,0,0,1,32,len(data),offset));offset+=len(data)
(OUT/'favicon.ico').write_bytes(header+b''.join(entries)+b''.join(data for _,data in frames))
# Export a static review sheet; inspect icons both native and enlarged, without CSS zoom.
paper='#F6F8F5';ink='#142D34'
sheet=Image.new('RGB',(960,570),paper)
from PIL import ImageDraw
pen=ImageDraw.Draw(sheet)
pen.text((24,16),'TraceMigo asset review - native-size icons, equal halves, grayscale, circle crop',fill=ink)
x=24
for size in [16,32,48,96]:
 image=Image.open(OUT/f'favicon-{size}.png').convert('RGBA');sheet.paste(image,(x,64),image);pen.text((x,170),f'{size}px',fill=ink);x+=150
for x,name in [(24,'app-icon-192.png'),(252,'maskable-icon-512.png'),(480,'social-avatar-512.png')]:
 image=Image.open(OUT/name).convert('RGBA').resize((192,192),Image.Resampling.LANCZOS)
 sheet.paste(image,(x,240),image);pen.text((x,450),name,fill=ink)
mask=Image.new('L',(192,192),0);ImageDraw.Draw(mask).ellipse((0,0,191,191),fill=255)
image=Image.open(OUT/'maskable-icon-512.png').convert('RGBA').resize((192,192),Image.Resampling.LANCZOS)
sheet.paste(image,(708,240),mask);pen.text((708,450),'maskable circle crop',fill=ink)
small=Image.open(OUT/'favicon-16.png').convert('L').convert('RGB').resize((96,96),Image.Resampling.NEAREST)
sheet.paste(small,(708,64));pen.text((708,170),'16px grayscale x6',fill=ink)
(ROOT/'docs/design/asset-review.png').parent.mkdir(parents=True,exist_ok=True);sheet.save(ROOT/'docs/design/asset-review.png')
manifest={str(p.relative_to(OUT)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='asset-manifest.json'}
(OUT/'asset-manifest.json').write_text(json.dumps({'schema_version':1,'generator':'tools/brand','assets':manifest},indent=2)+'\n')
print('Created multi-resolution ICO, review sheet and asset hashes.')
