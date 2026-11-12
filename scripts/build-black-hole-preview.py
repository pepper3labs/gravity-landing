"""Build a portable offline preview using the exact runtime fragment shader and LUT."""
from pathlib import Path
import base64
root=Path(__file__).resolve().parents[1]
template=(root/'scripts/black-hole-preview.template.html').read_text(encoding='utf-8')
html=template.replace('__FRAGMENT__',(root/'src/black-hole.frag').read_text(encoding='utf-8'))
html=html.replace('__LUT__',base64.b64encode((root/'src/assets/black-hole-orbits.png').read_bytes()).decode('ascii'))
out=root/'artifacts/black-hole-preview.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html,encoding='utf-8')
print(f'{out}: {out.stat().st_size} bytes; standalone, no network requests')
