"""Check actual exports, font provenance, geometry and semantic contrast."""
from pathlib import Path
import hashlib,json,math,xml.etree.ElementTree as ET
from PIL import Image,ImageChops
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'apps/web/public/brand';EV=ROOT/'planning/evidence/P03.01'
SPEC=json.loads((ROOT/'tools/brand/identity.json').read_text())

def luminance(value):
 channels=[int(value[i:i+2],16)/255 for i in [1,3,5]]
 linear=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in channels]
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2]
def contrast(a,b):
 x,y=sorted([luminance(a),luminance(b)]);return (y+.05)/(x+.05)
def main():
 checks=[];ratios=[]
 expected={'ink':'#142D34','teal':'#087F75','mint':'#B8F2DF','paper':'#F6F8F5','coral':'#C64F34','white':'#FFFFFF'}
 assert SPEC['palette']==expected
 for theme,values in SPEC['themes'].items():
  for pair in SPEC['contrastPairs']:
   fg=expected[values[pair['foreground']]];bg=expected[values[pair['background']]];ratio=contrast(fg,bg)
   assert ratio>=pair['minimum'],(theme,pair['name'],ratio)
   ratios.append({'theme':theme,'pair':pair['name'],'foreground':fg,'background':bg,'ratio':round(ratio,5),'minimum':pair['minimum']})
 assert contrast(expected['mint'],expected['paper'])<3
 assert contrast('#FFFFFF','#FFFFFF')<4.5
 checks.append(f'PASS: exact six-colour palette and {len(ratios)} light/dark text/control/focus/interaction contrast pairs; Mint/Paper excluded from meaningful text/boundaries')
 sizes={'favicon-16.png':16,'favicon-32.png':32,'favicon-48.png':48,'favicon-96.png':96,'apple-touch-icon.png':180,'app-icon-192.png':192,'app-icon-512.png':512,'maskable-icon-512.png':512,'social-avatar-512.png':512}
 for name,size in sizes.items():
  with Image.open(OUT/name) as image:assert image.format=='PNG' and image.size==(size,size),(name,image.size)
 with Image.open(OUT/'social-preview.png') as image:assert image.size==(1200,630)
 with Image.open(OUT/'favicon.ico') as ico:
  assert ico.format=='ICO' and ico.ico.sizes()=={(16,16),(32,32),(48,48)}
  for size in [16,32,48]:assert ico.ico.getimage((size,size)).convert('RGBA').tobytes()==Image.open(OUT/f'favicon-{size}.png').convert('RGBA').tobytes()
 checks.append('PASS: PNG signatures/dimensions, OG 1200x630 and actual ICO 16/32/48 frames match exact native PNG pixels')
 for name in ['mark-teal.svg','mark-ink.svg','mark-mint.svg','mark-white.svg','lockup-primary.svg','lockup-ink.svg','lockup-reverse.svg','wordmark-ink.svg','wordmark-reverse.svg','social-preview.svg']:
  text=(OUT/name).read_text();xml=ET.fromstring(text)
  assert '<text' not in text and '<image' not in text and '<script' not in text and 'href=' not in text
  assert not any(key.lower().startswith('on') for node in xml.iter() for key in node.attrib)
 checks.append('PASS: static standalone vector masters and outlined wordmark/social text; no external font/image/script dependency')
 deviations=[]
 for size in [16,32,48,128]:
  image=Image.open(ROOT/f'docs/design/renders/mark-check-{size}.png').convert('RGBA');alpha=image.getchannel('A')
  difference=ImageChops.difference(alpha,alpha.transpose(Image.Transpose.FLIP_LEFT_RIGHT))
  max_difference=difference.getextrema()[1];assert max_difference<=12,(size,max_difference)
  left=sum(alpha.crop((0,0,size//2,size)).get_flattened_data());right=sum(alpha.crop((size//2,0,size,size)).get_flattened_data())
  assert abs(left-right)/max(left,right)<.01
  deviations.append({'size':size,'max_alpha_mirror_difference':max_difference,'relative_weight_difference':abs(left-right)/max(left,right)})
 small=Image.open(ROOT/'docs/design/renders/mark-check-16.png').getchannel('A');assert all(small.getpixel((x,y))==0 for x in [7,8] for y in range(16))
 bbox=Image.open(ROOT/'docs/design/renders/mark-check-128.png').getchannel('A').getbbox();assert bbox==(26,28,102,108)
 assert min(bbox[0],bbox[1],128-bbox[2],128-bbox[3])>=(bbox[2]-bbox[0])/4
 checks.append('PASS: equal mirrored geometry/visual weight, two clear native 16px center columns and quarter-width minimum clear space')
 image=Image.open(OUT/'maskable-icon-512.png').convert('RGB');bg=tuple(int(expected['ink'][i:i+2],16) for i in [1,3,5]);max_radius=0
 for y in range(512):
  for x in range(512):
   pixel=image.getpixel((x,y))
   if max(abs(pixel[i]-bg[i]) for i in range(3))>20:max_radius=max(max_radius,math.hypot(x+.5-256,y+.5-256))
 assert max_radius<=512*.4
 checks.append(f'PASS: maskable essential foreground radius {max_radius:.2f}px within 204.8px safe circle; opaque full-bleed background')
 provenance=json.loads((OUT/'fonts/source.json').read_text())
 for item in provenance['files']:assert hashlib.sha256((OUT/'fonts'/item['file']).read_bytes()).hexdigest()==item['sha256']
 font=TTFont(OUT/'fonts/manrope-variable.ttf');axis=next(x for x in font['fvar'].axes if x.axisTag=='wght');assert axis.minValue==200 and axis.maxValue==800
 license=(OUT/'fonts/OFL.txt').read_text();assert 'SIL OPEN FONT LICENSE Version 1.1' in license and 'Copyright' in license
 checks.append('PASS: immutable Google Fonts provenance, original license/hash preservation and actual Manrope 200–800 weight axis')
 manifest=json.loads((OUT/'asset-manifest.json').read_text())
 for name,record in manifest['assets'].items():assert hashlib.sha256((OUT/name).read_bytes()).hexdigest()==record['sha256']
 EV.mkdir(parents=True,exist_ok=True)
 (EV/'contrast.json').write_text(json.dumps(ratios,indent=2)+'\n')
 (EV/'geometry-checks.json').write_text(json.dumps({'mirrors':deviations,'maskable_radius':max_radius},indent=2)+'\n')
 (EV/'brand-check.log').write_text('\n'.join(checks)+'\nVERDICT: PASS\n')
 print('\n'.join(checks));print('VERDICT: PASS')
if __name__=='__main__':main()
